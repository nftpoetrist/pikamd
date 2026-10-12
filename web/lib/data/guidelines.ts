import type { Guideline } from "@/lib/types";
import { MOCK_GUIDELINES } from "@/lib/data/mock-guidelines";
import { searchGuidelines as runSearch, type SearchOutcome } from "@/lib/search/engine";

// Single entry point for guideline reads. Pages only call these functions,
// so swapping mock data for Supabase (roadmap step 6) is a change in this file only.
export async function listGuidelines(): Promise<Guideline[]> {
  return MOCK_GUIDELINES;
}

export async function getGuideline(slug: string): Promise<Guideline | null> {
  return MOCK_GUIDELINES.find((g) => g.slug === slug) ?? null;
}

/**
 * Search (lib/search): today over the whole mock list. With Supabase, Postgres full-text search
 * (search_tsv, ARCHITECTURE §10) narrows the candidates first and the same engine ranks them
 * and builds the highlights, so results look the same.
 */
export async function searchIndex(query: string, options: { limit?: number; maxLines?: number } = {}): Promise<SearchOutcome> {
  return runSearch(await listGuidelines(), query, options);
}
