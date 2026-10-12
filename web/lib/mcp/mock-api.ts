import "server-only";
import { listGuidelines } from "@/lib/data/guidelines";
import { MOCK_ENABLED } from "@/lib/mcp/mock-store";

// Guards for the local-preview endpoints under /api/mock. They take writes from this site's own
// pages only: 404 in production, 403 unless the browser says the request comes from this origin
// (another site open in the same browser can't touch the local store), 415 unless JSON.
export function mockGuard(request: Request, { json }: { json: boolean }): Response | null {
  if (!MOCK_ENABLED) return new Response("Not found", { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
  }
  if (json && !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Send JSON" }, { status: 415 });
  }
  return null;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Known slugs only, no duplicates, order kept (newest first). Null if the value isn't a string list. */
export async function cleanSlugs(value: unknown): Promise<string[] | null> {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const known = new Set((await listGuidelines()).map((g) => g.slug));
  return [...new Set(value.filter((s): s is string => typeof s === "string" && known.has(s)))];
}
