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

/** The JSON object body, or null if the body isn't a JSON object. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Per-user answers must never be cached by the browser or a CDN. */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

export const notConfigured = () =>
  Response.json({ error: "Wallet sign-in isn't live yet on this server" }, { status: 503, headers: NO_STORE });
