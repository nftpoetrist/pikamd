import "server-only";
import { listGuidelines } from "@/lib/data/guidelines";
import { MOCK_ENABLED } from "@/lib/mcp/mock-store";
import { sameOriginGuard } from "@/lib/server/guard";

// Guards for the local-preview endpoints under /api/mock: 404 in production, otherwise the
// same-origin and JSON checks every write endpoint uses (lib/server/guard.ts).
export function mockGuard(request: Request, { json }: { json: boolean }): Response | null {
  if (!MOCK_ENABLED) return new Response("Not found", { status: 404 });
  return sameOriginGuard(request, { json });
}

/** Known slugs only, no duplicates, order kept (newest first). Null if the value isn't a string list. */
export async function cleanSlugs(value: unknown): Promise<string[] | null> {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const known = new Set((await listGuidelines()).map((g) => g.slug));
  return [...new Set(value.filter((s): s is string => typeof s === "string" && known.has(s)))];
}
