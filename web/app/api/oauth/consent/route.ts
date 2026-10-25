import { connection } from "next/server";
import { authorizationRedirect, issuerFor, newSecret } from "@/lib/oauth/core";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { answerRequest, originOf, requestInfo } from "@/lib/server/oauth";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabase } from "@/lib/server/supabase";

// The consent screen's API (app/oauth/consent). Same-origin only: the screen is reached by a
// cross-site redirect from the agent, which doesn't carry the SameSite=Strict session cookie, so
// the page asks here after it loads, and these same-site requests do carry it.

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

/** What the screen shows for a pending request. */
export async function GET(request: Request) {
  await connection();
  if (!supabase()) return fail(503, "Sign-in for agents isn't available on this server yet");
  const info = await requestInfo(new URL(request.url).searchParams.get("request") ?? "");
  if (!info) return fail(404, "This sign-in request has expired or was already answered");
  return Response.json(info, { headers: NO_STORE });
}

/** Allow (needs the signed-in wallet) or cancel. Answers with the client's redirect URL. */
export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  const origin = originOf(request);
  if (!origin) return fail(421, "Unknown host");
  if (!supabase()) return fail(503, "Sign-in for agents isn't available on this server yet");
  const body = await readJson(request);
  const requestId = typeof body?.request === "string" ? body.request : "";
  const allow = body?.allow === true;

  const wallet = await sessionWallet();
  if (allow && !wallet) return fail(401, "Sign in with your wallet first");
  const limited = await rateLimited("oauthConsent", { request, wallet });
  if (limited) return limited;

  const code = newSecret("code");
  const answered = allow ? await answerRequest(requestId, { allow: true, wallet: wallet!, code }) : await answerRequest(requestId, { allow: false });
  if (!answered) return fail(404, "This sign-in request has expired or was already answered");
  const params = allow ? { code } : { error: "access_denied", error_description: "The user cancelled" };
  return Response.json({ redirect: authorizationRedirect(answered.redirectUri, params, answered.state, issuerFor(origin)) }, { headers: NO_STORE });
}
