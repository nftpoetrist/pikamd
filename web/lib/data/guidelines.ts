import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Guideline, GuidelineCard } from "@/lib/types";
import { MOCK_GUIDELINES } from "@/lib/data/mock-guidelines";
import { GUIDELINE_COLUMNS, forAgents, rowToGuideline, type GuidelineRow } from "@/lib/data/rows";
import { searchGuidelines as runSearch, type SearchOutcome } from "@/lib/search/engine";
import { check, supabase } from "@/lib/server/supabase";

// Single entry point for guideline reads. Supabase (`listed_guidelines`: hidden and locked
// guidelines never appear) when SUPABASE_URL and SUPABASE_SECRET_KEY are set; otherwise the sample
// data in development and nothing in production (samples must never pass for real guidelines). Cached for a minute and tagged, so a publish can refresh it at once
// (revalidateTag(GUIDELINES_TAG)). Counts that change often (likes) come from /api/likes.

export const GUIDELINES_TAG = "guidelines";

export async function listGuidelines(): Promise<Guideline[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDELINES_TAG);

  const db = supabase();
  if (!db) {
    if (process.env.NODE_ENV !== "production") return MOCK_GUIDELINES;
    console.error("[guidelines] SUPABASE_URL / SUPABASE_SECRET_KEY are not set: listing nothing");
    return [];
  }
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

/**
 * The list for pages that show cards (Explore, My Collection): no file contents, so a page's size
 * doesn't grow with every file in the library. A preview loads its file from /api/guidelines/[slug].
 */
export async function listGuidelineCards(): Promise<GuidelineCard[]> {
  return (await listGuidelines()).map(toCard);
}

function toCard(g: Guideline): GuidelineCard {
  const { content, ...card } = g;
  void content;
  return card;
}

/** The list the MCP server serves: flagged guidelines stay off until a moderator checks them. */
export async function listGuidelinesForAgents(): Promise<Guideline[]> {
  return forAgents(await listGuidelines());
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
