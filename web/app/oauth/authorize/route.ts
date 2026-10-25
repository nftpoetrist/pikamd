import { connection } from "next/server";
import {
  authorizationRedirect,
  grantedScope,
  isCodeChallenge,
  isLoopbackRedirect,
  isState,
  issuerFor,
  newSecret,
  redirectMatches,
  resourceFor,
  sameResource,
} from "@/lib/oauth/core";
import { createRequest, originOf, resolveClient } from "@/lib/server/oauth";
import { rateLimited } from "@/lib/server/ratelimit";

// Authorization endpoint (RFC 6749 §4.1.1, OAuth 2.1, MCP authorization). Checks the request and
// parks it for the consent screen at /oauth/consent. Until the client and its redirect URI are
// known to be genuine, problems are shown on PikaMd's own page and never redirected anywhere
// (RFC 6749 §4.1.2.1, open redirection). After that, they go back to the client with state and iss.

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** PikaMd's consent page with an error code it explains; nothing the request sent is echoed. */
const errorPage = (origin: string, code: string) =>
  Response.redirect(`${origin}/oauth/consent?error=${encodeURIComponent(code)}`, 303);

export async function GET(request: Request) {
  await connection();
  const origin = originOf(request);
  if (!origin) return new Response("Unknown host", { status: 421, headers: NO_STORE });
  const limited = await rateLimited("oauthAuthorize", { request });
  if (limited) return errorPage(origin, "rate_limited");

  const url = new URL(request.url);
  const q = url.searchParams;
  // RFC 6749 §3.1: parameters sent without a value are omitted; none may repeat
  for (const key of new Set(q.keys())) if (q.getAll(key).length > 1) return errorPage(origin, "invalid_request");
  const param = (k: string) => q.get(k) || null;

  // 1. Who is asking, and where would the answer go
  const clientId = param("client_id");
  if (!clientId) return errorPage(origin, "invalid_client");
  const client = await resolveClient(clientId);
  if ("error" in client) return errorPage(origin, "invalid_client");

  let redirectUri = param("redirect_uri");
  if (!redirectUri) {
    // OAuth 2.1 §4.1.1: optional only when the client registered exactly one, and a loopback URI
    // always needs the port the client is listening on
    const only = client.redirectUris.length === 1 ? client.redirectUris[0] : null;
    if (!only || isLoopbackRedirect(only)) return errorPage(origin, "invalid_redirect_uri");
    redirectUri = only;
  }
  if (!redirectMatches(redirectUri, client.redirectUris)) return errorPage(origin, "invalid_redirect_uri");

  // 2. From here on, errors go back to the client
  const issuer = issuerFor(origin);
  const rawState = param("state");
  const state = rawState !== null && isState(rawState) ? rawState : null;
  const fail = (error: string, description: string) =>
    Response.redirect(authorizationRedirect(redirectUri, { error, error_description: description }, state, issuer), 303);

  if (rawState !== null && state === null) return fail("invalid_request", "state is too long or has control characters");
  if (param("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported");
  if (param("request") || param("request_uri")) return fail("invalid_request", "Request objects aren't supported");
  const challenge = param("code_challenge");
  if (!challenge || param("code_challenge_method") !== "S256") return fail("invalid_request", "PKCE with code_challenge_method=S256 is required");
  if (!isCodeChallenge(challenge)) return fail("invalid_request", "code_challenge isn't a valid S256 challenge");
  const scope = grantedScope(param("scope"));
  if ("error" in scope) return fail("invalid_scope", scope.error);
  const resource = resourceFor(origin);
  const requestedResource = param("resource");
  if (requestedResource !== null && !sameResource(requestedResource, resource)) {
    return fail("invalid_target", `This server issues tokens for ${resource} only`);
  }

  // 3. Park it for the consent screen
  const requestId = newSecret("request");
  try {
    await createRequest(requestId, { client, redirectUri, state, codeChallenge: challenge, resource, scope: scope.scope });
  } catch {
    return fail("server_error", "Couldn't start sign-in, try again");
  }
  return Response.redirect(`${origin}/oauth/consent?request=${requestId}`, 303);
}
