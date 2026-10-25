import { newSecret, parseRegistration } from "@/lib/oauth/core";
import { readJson } from "@/lib/server/guard";
import { jsonResponse, oauthError, preflight } from "@/lib/server/oauth-http";
import { originOf, registerClient } from "@/lib/server/oauth";
import { rateLimited } from "@/lib/server/ratelimit";

// Dynamic Client Registration (RFC 7591). Deprecated in MCP in favour of Client ID Metadata
// Documents, which Claude uses; kept for VS Code, Cursor, Codex and other clients that register.
// Every client is public (token_endpoint_auth_method "none", no secret is ever issued), and only
// https or loopback redirect URIs are accepted. The consent screen marks these apps as unverified.

export async function POST(request: Request) {
  const origin = originOf(request);
  if (!origin) return oauthError("invalid_request", "Unknown host", 421);
  const limited = await rateLimited("oauthRegister", { request });
  if (limited) return oauthError("slow_down", "Too many registrations. Wait and try again", 429);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return oauthError("invalid_client_metadata", "Send the client metadata as application/json");
  }
  const parsed = parseRegistration(await readJson(request, 16 * 1024));
  if ("error" in parsed) return oauthError(parsed.field === "redirect_uris" ? "invalid_redirect_uri" : "invalid_client_metadata", parsed.error);

  const clientId = newSecret("client");
  try {
    await registerClient(clientId, parsed.name, parsed.redirectUris);
  } catch {
    return oauthError("server_error", "Couldn't register the client, try again", 500);
  }
  return jsonResponse(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: parsed.name,
      redirect_uris: parsed.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

export const OPTIONS = preflight;
