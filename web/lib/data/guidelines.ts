import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Guideline, GuidelineCard } from "@/lib/types";
import { MOCK_GUIDELINES } from "@/lib/data/mock-guidelines";
import { CARD_COLUMNS, GUIDELINE_COLUMNS, forAgents, rowToCard, rowToGuideline, type GuidelineCardRow, type GuidelineRow } from "@/lib/data/rows";
import { searchGuidelines as runSearch, type SearchOutcome } from "@/lib/search/engine";
import { check, supabase } from "@/lib/server/supabase";

// Single entry point for guideline reads. Supabase (`listed_guidelines`: hidden and locked
// guidelines never appear) when SUPABASE_URL and SUPABASE_SECRET_KEY are set; otherwise the sample
// data in development and nothing in production (samples must never pass for real guidelines).
// Counts that change often (likes) come from /api/likes.
//
// Freshness: "use cache" keeps entries in each server instance's own memory, and revalidateTag
// only clears the instance that calls it (next/dist/server/lib/cache-handlers/default.js; Vercel
// docs, Runtime Cache), so a cached list can be minutes old (2026-10-22). Two lists, then:
// - pages get the card list in their prerendered shell (stale ≥ 5 minutes is what Next needs to
//   put it in the App Shell), so a navigation shows the cards at once, never an empty fallback;
// - the browser then asks GET /api/guidelines (lib/library/client.ts), which reads a list that
//   lives for one second, and swaps in whatever changed.
// Search, MCP and /raw use the one-second list; a guideline's page reads just its own row
// (getGuideline), cached so a link can prefetch it.

export const GUIDELINES_TAG = "guidelines";

export async function listGuidelines(): Promise<Guideline[]> {
  "use cache";
  cacheLife("seconds");
  cacheTag(GUIDELINES_TAG);

  const rows = await listedRows<GuidelineRow>(GUIDELINE_COLUMNS);
  if (!rows) return process.env.NODE_ENV !== "production" ? MOCK_GUIDELINES : [];
  return mapRows(rows, rowToGuideline);
}

/**
 * The list for pages that show cards (Explore, My Collection, Publish's name check), in their
 * prerendered shell: no file contents, so a page's size doesn't grow with every file in the
 * library. A preview loads its file from /api/guidelines/[slug].
 */
export async function listGuidelineCards(): Promise<GuidelineCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDELINES_TAG);
  return readCards();
}

/** The same cards, at most a second old: what the browser refreshes the page's list with. */
export async function listFreshGuidelineCards(): Promise<GuidelineCard[]> {
  "use cache";
  cacheLife("seconds");
  cacheTag(GUIDELINES_TAG);
  return readCards();
}

async function readCards(): Promise<GuidelineCard[]> {
  const rows = await listedRows<GuidelineCardRow>(CARD_COLUMNS);
  if (!rows) return process.env.NODE_ENV !== "production" ? MOCK_GUIDELINES.map(toCard) : [];
  return mapRows(rows, rowToCard);
}

/** Listed rows, newest first; null without a database. */
async function listedRows<R>(columns: string): Promise<R[] | null> {
  const db = supabase();
  if (!db) {
    if (process.env.NODE_ENV === "production") console.error("[guidelines] SUPABASE_URL / SUPABASE_SECRET_KEY are not set: listing nothing");
    return null;
  }
  return check(await db.from("listed_guidelines").select(columns).order("block_number", { ascending: false }), "list guidelines") as R[];
}

function mapRows<R extends { id: number | string }, G>(rows: R[], map: (row: R) => G | null): G[] {
  const out: G[] = [];
  for (const row of rows) {
    const g = map(row);
    if (g) out.push(g);
    else console.error(`[guidelines] skipped malformed row id=${String(row.id)}`);
  }
  return out;
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

/**
 * One listed guideline with its file (its page, the preview). Only that row is read, and it's
 * cached long enough (stale ≥ 5 minutes) for a `<Link prefetch>` to bring the page along before
 * the click. Agents and /raw don't use it: they read the one-second list.
 */
export async function getGuideline(slug: string): Promise<Guideline | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDELINES_TAG);

  const db = supabase();
  if (!db) return process.env.NODE_ENV !== "production" ? (MOCK_GUIDELINES.find((g) => g.slug === slug) ?? null) : null;
  const rows = check(await db.from("listed_guidelines").select(GUIDELINE_COLUMNS).eq("slug", slug).limit(1), "get guideline") as GuidelineRow[];
  return mapRows(rows, rowToGuideline)[0] ?? null;
}

/**
 * Search (lib/search) over the listed guidelines. At larger scale, Postgres full-text search
 * narrows the candidates first and the same engine ranks them and builds the highlights.
 */
export async function searchIndex(query: string, options: { limit?: number; maxLines?: number } = {}): Promise<SearchOutcome> {
  return runSearch(await listGuidelines(), query, options);
}
