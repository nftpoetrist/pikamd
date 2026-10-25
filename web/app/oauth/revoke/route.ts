import { jsonResponse, oauthError, preflight, readForm, usesClientSecret } from "@/lib/server/oauth-http";
import { originOf, revokeToken } from "@/lib/server/oauth";
import { rateLimited } from "@/lib/server/ratelimit";

// Token revocation (RFC 7009): a client signs out. A refresh token ends the whole connection, an
// access token only itself. Unknown tokens, or tokens of another client, are answered with 200
// too (§2.2), so the endpoint says nothing about which tokens exist.

export async function POST(request: Request) {
  if (!originOf(request)) return oauthError("invalid_request", "Unknown host", 421);
  const limited = await rateLimited("oauthToken", { request });
  if (limited) return oauthError("slow_down", "Too many requests. Wait a few minutes", 429);
  const form = await readForm(request);
  if (!form) return oauthError("invalid_request", "Send application/x-www-form-urlencoded parameters, each once");
  if (usesClientSecret(request, form)) return oauthError("invalid_client", "PikaMd clients are public: send client_id only, no secret", 401);
  const token = form.get("token");
  const clientId = form.get("client_id");
  if (!token || !clientId) return oauthError("invalid_request", "token and client_id are required");
  try {
    await revokeToken(token, clientId);
  } catch {
    return oauthError("server_error", "Couldn't revoke the token, try again", 503);
  }
  return jsonResponse({}, 200);
}

export const OPTIONS = preflight;
