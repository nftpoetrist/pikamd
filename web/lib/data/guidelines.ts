import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Guideline } from "@/lib/types";
import { MOCK_GUIDELINES } from "@/lib/data/mock-guidelines";
import { GUIDELINE_COLUMNS, rowToGuideline, type GuidelineRow } from "@/lib/data/rows";
import { searchGuidelines as runSearch, type SearchOutcome } from "@/lib/search/engine";
import { check, supabase } from "@/lib/server/supabase";

// Single entry point for guideline reads. Supabase (`listed_guidelines`: delisted and flagged
// guidelines never appear) when SUPABASE_URL and SUPABASE_SECRET_KEY are set, otherwise the
// sample data. Cached for a minute and tagged, so a publish can refresh it at once
// (revalidateTag(GUIDELINES_TAG)). Counts that change often (likes) come from /api/likes.

export const GUIDELINES_TAG = "guidelines";

export async function listGuidelines(): Promise<Guideline[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDELINES_TAG);

  const db = supabase();
  if (!db) return MOCK_GUIDELINES;
  const rows = check(
    await db.from("listed_guidelines").select(GUIDELINE_COLUMNS).order("block_number", { ascending: false }),
    "list guidelines",
  ) as GuidelineRow[];
  const out: Guideline[] = [];
  for (const row of rows) {
    const g = rowToGuideline(row);
    if (g) out.push(g);
    else console.error(`[guidelines] skipped malformed row id=${String(row.id)}`);
  }
  return out;
}

export async function getGuideline(slug: string): Promise<Guideline | null> {
  return (await listGuidelines()).find((g) => g.slug === slug) ?? null;
}

/**
 * Search (lib/search) over the listed guidelines. At larger scale, Postgres full-text search
 * narrows the candidates first and the same engine ranks them and builds the highlights.
 */
export async function searchIndex(query: string, options: { limit?: number; maxLines?: number } = {}): Promise<SearchOutcome> {
  return runSearch(await listGuidelines(), query, options);
}
