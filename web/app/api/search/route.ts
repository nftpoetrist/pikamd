import { searchIndex } from "@/lib/data/guidelines";
import { SEARCH_LIMIT_MAX } from "@/lib/search/engine";
import { QUERY_MAX_LENGTH } from "@/lib/search/query";
import { toSearchResponse } from "@/lib/search/response";

// Public guideline search for the Explore search bar (query language: lib/search/query.ts).
// GET /api/search?q=…&limit=8. Read-only and the same for everyone; no sign-in.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").slice(0, QUERY_MAX_LENGTH);
  const limitParam = Number(params.get("limit") ?? 8);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), SEARCH_LIMIT_MAX) : 8;

  const outcome = await searchIndex(q, { limit, maxLines: 2 });
  return Response.json(toSearchResponse(outcome), { headers: { "Cache-Control": "no-store" } });
}
