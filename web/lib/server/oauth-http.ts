import "server-only";

// HTTP pieces shared by the OAuth endpoints (app/oauth/*, app/.well-known/*).

/**
 * Discovery, registration, token and revocation answers carry no cookies and no user data beyond
 * the requester's own token, so any origin may read them (browser-based MCP clients and inspectors
 * call them with fetch). The consent API under /api/oauth is same-origin only.
 */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
} as const;

/** RFC 6749 §5.1: token responses must not be cached. */
export const TOKEN_HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS, ...TOKEN_HEADERS, ...headers } });
}

/** An OAuth error body (RFC 6749 §5.2): `error` code plus a short human description. */
export function oauthError(error: string, description: string, status = 400): Response {
  return jsonResponse({ error, error_description: description }, status);
}

/** Discovery documents: public and the same for everyone, so caches may keep them for a while. */
export function metadataResponse(body: unknown): Response {
  return Response.json(body, { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}

/**
 * An application/x-www-form-urlencoded body (RFC 6749 §4.1.3), read as a stream up to `maxBytes`.
 * Null if the content type is different, the body is too large or a parameter repeats (RFC 6749
 * §3.2: parameters must not be included more than once).
 */
export async function readForm(request: Request, maxBytes = 8 * 1024): Promise<Map<string, string> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return null;
  if (Number(request.headers.get("content-length")) > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return null;
  }
  const out = new Map<string, string>();
  for (const [k, v] of new URLSearchParams(text)) {
    if (out.has(k)) return null;
    out.set(k, v);
  }
  return out;
}

/** Client credentials sent with HTTP Basic: refused, every PikaMd client is public. */
export const usesClientSecret = (request: Request, form: Map<string, string>) =>
  /^basic\s/i.test(request.headers.get("authorization") ?? "") || form.has("client_secret") || form.has("client_assertion");
