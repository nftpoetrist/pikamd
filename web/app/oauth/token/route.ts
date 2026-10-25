import { ACCESS_TTL_S, isCodeVerifier, isSecret, newSecret, resourceFor, s256, sameResource } from "@/lib/oauth/core";
import { jsonResponse, oauthError, preflight, readForm, usesClientSecret } from "@/lib/server/oauth-http";
import { exchangeCode, originOf, refreshTokens, type TokenOutcome } from "@/lib/server/oauth";
import { rateLimited } from "@/lib/server/ratelimit";

// Token endpoint (RFC 6749 §3.2, OAuth 2.1 §4.1.3 and §4.3). Form-encoded only; every client is
// public, so PKCE (authorization_code) and the client_id binding (refresh_token) are the proof.
// Refresh tokens rotate on every use (MCP security considerations, public clients).

export async function POST(request: Request) {
  const origin = originOf(request);
  if (!origin) return oauthError("invalid_request", "Unknown host", 421);
  const limited = await rateLimited("oauthToken", { request });
  if (limited) return oauthError("slow_down", "Too many requests. Wait a few minutes", 429);

  const form = await readForm(request);
  if (!form) return oauthError("invalid_request", "Send application/x-www-form-urlencoded parameters, each once");
  if (usesClientSecret(request, form)) return oauthError("invalid_client", "PikaMd clients are public: send client_id only, no secret", 401);
  const clientId = form.get("client_id");
  if (!clientId || clientId.length > 512) return oauthError("invalid_request", "client_id is required");

  const canonical = resourceFor(origin);
  const requestedResource = form.get("resource") ?? null;
  if (requestedResource !== null && !sameResource(requestedResource, canonical)) {
    return oauthError("invalid_target", `This server issues tokens for ${canonical} only`);
  }
  const resource = requestedResource === null ? null : canonical;

  const access = newSecret("access");
  const refresh = newSecret("refresh");
  let outcome: TokenOutcome;
  try {
    switch (form.get("grant_type")) {
      case "authorization_code": {
        const code = form.get("code");
        const verifier = form.get("code_verifier");
        if (!isSecret("code", code)) return oauthError("invalid_grant", "The code is invalid, expired or already used");
        if (!isCodeVerifier(verifier)) return oauthError("invalid_request", "code_verifier is required (43 to 128 characters)");
        outcome = await exchangeCode({
          code,
          clientId,
          redirectUri: form.get("redirect_uri") ?? null,
          verifierChallenge: s256(verifier),
          resource,
          access,
          refresh,
        });
        break;
      }
      case "refresh_token": {
        const old = form.get("refresh_token");
        if (!isSecret("refresh", old)) return oauthError("invalid_grant", "The refresh token is invalid, expired or revoked");
        outcome = await refreshTokens({ refresh: old, clientId, resource, access, newRefresh: refresh });
        break;
      }
      case undefined:
        return oauthError("invalid_request", "grant_type is required");
      default:
        return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token");
    }
  } catch {
    return oauthError("server_error", "Couldn't issue a token, try again", 500);
  }

  if (outcome.status === "invalid_target") return oauthError("invalid_target", `This server issues tokens for ${canonical} only`);
  if (outcome.status !== "ok") return oauthError("invalid_grant", "The code or refresh token is invalid, expired, already used or for another client");
  return jsonResponse({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: outcome.scope });
}

export const OPTIONS = preflight;
