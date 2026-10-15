import "server-only";

// Writes are accepted from this site's own pages only: browsers send an Origin header on
// POST/PUT/DELETE, and another site open in the same browser can't fake it (CSRF guard,
// on top of the SameSite=Strict session cookie). 415 unless JSON when a body is expected.
export function sameOriginGuard(request: Request, { json }: { json: boolean }): Response | null {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
  }
  if (json && !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Send JSON" }, { status: 415 });
  }
  return null;
}

/**
 * The JSON object body, or null if the body isn't a JSON object or is over `maxBytes`. The body is
 * read as a stream and the read stops at the limit, so a client can't make the server buffer an
 * unbounded body (Content-Length may be missing or wrong).
 */
export async function readJson(request: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("content-length")) > maxBytes || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
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
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.byteLength;
    }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Per-user answers must never be cached by the browser or a CDN. */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const notConfigured = () =>
  Response.json({ error: "Wallet sign-in isn't live yet on this server" }, { status: 503, headers: NO_STORE });
