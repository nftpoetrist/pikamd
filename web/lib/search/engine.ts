// Guideline search: one engine for the Explore search bar (/api/search) and the MCP tool
// search_guidelines, so a person and their agent get the same results.
// - Words match at the start of a word or word part: "memo" finds useMemo, "go" doesn't find "algorithm".
// - Every word or phrase must match somewhere (title, slug, tags, type, summary, author, file content).
// - Typo tolerance only for words of 5+ letters (1 edit; 2 edits from 8 letters). Guidelines that
//   match without typos always rank above those that only match with one.
// - Ranking: where it matched (title > slug > tags > type > summary/author > headings > text),
//   how well (exact > prefix > typo), then likes.
// - Hits carry highlight ranges and the matching lines of the file, with line numbers.
// Pure: the data layer passes the list (mock today; Supabase full-text candidates later).
import type { Guideline } from "@/lib/types";
import { isEmptyQuery, parseQuery, type Clause, type ParsedQuery } from "./query.ts";
import { editDistance, fold, mergeRanges, tokenize, words, type Range, type Token } from "./text.ts";

const WEIGHT = { title: 10, slug: 8, tag: 6, kind: 5, description: 4, author: 4, heading: 2, content: 1 } as const;
type FieldName = keyof typeof WEIGHT;

type Quality = 3 | 2 | 1; // exact, prefix, typo
const QUALITY_FACTOR: Record<Quality, number> = { 3: 1, 2: 0.7, 1: 0.4 };
const PHRASE_FACTOR = 1.2;
const TITLE_BONUS = 6;

export const SEARCH_LIMIT_DEFAULT = 10;
export const SEARCH_LIMIT_MAX = 25;
const LINE_MAX_CHARS = 110;

export type LineHit = { line: number; text: string; ranges: Range[] };
export type SearchHit = {
  guideline: Guideline;
  score: number;
  /** False when at least one word only matched through typo tolerance. */
  exact: boolean;
  title: Range[];
  description: Range[];
  lines: LineHit[];
};
export type SearchOutcome = { hits: SearchHit[]; total: number; warnings: string[]; query: ParsedQuery };

type Field = { name: FieldName; text: string; tokens: Token[]; whole: Token[]; line?: number };
type Indexed = { fields: Field[]; tags: string[]; handle: string; address: string };

const field = (name: FieldName, text: string, line?: number): Field => {
  const tokens = tokenize(text);
  return { name, text, tokens, whole: words(tokens), line };
};

// Built once per guideline object (the list is immutable per request / per mock load)
const cache = new WeakMap<Guideline, Indexed>();
function index(g: Guideline): Indexed {
  let ix = cache.get(g);
  if (ix) return ix;
  const fields: Field[] = [
    field("title", g.title),
    field("slug", g.slug),
    ...g.tags.map((t) => field("tag", t)),
    field("kind", g.kind),
    field("description", g.description),
    field("author", [g.author.handle ? `@${g.author.handle}` : "", g.author.address].join(" ")),
    ...g.content.split("\n").map((text, i) => field(/^#{1,6}\s/.test(text) ? "heading" : "content", text, i + 1)),
  ];
  ix = { fields, tags: g.tags.map(fold), handle: fold(g.author.handle ?? ""), address: g.author.address.toLowerCase() };
  cache.set(g, ix);
  return ix;
}

type FieldMatch = { quality: Quality; ranges: Range[] };

function tokenQuality(term: string, token: string): Quality | 0 {
  if (token === term) return 3;
  if (term.length >= 2 && token.startsWith(term)) return 2;
  if (term.length >= 5 && token.length >= 4) {
    const max = term.length >= 8 ? 2 : 1;
    if (editDistance(term, token, max) <= max) return 1;
  }
  return 0;
}

function matchClause(clause: Clause, f: Field, allowTypos: boolean): FieldMatch | null {
  if (!clause.phrase) {
    const term = clause.tokens[0];
    let best: Quality | 0 = 0;
    const found: { q: Quality; r: Range }[] = [];
    for (const t of f.tokens) {
      const q = tokenQuality(term, t.text);
      if (q === 0 || (q === 1 && !allowTypos)) continue;
      found.push({ q, r: [t.start, t.end] });
      if (q > best) best = q;
    }
    if (best === 0) return null;
    // Highlight what earned the best quality, plus anything better than a typo
    const ranges = found.filter((x) => x.q === best || x.q > 1).map((x) => x.r);
    return { quality: best, ranges };
  }
  // Phrase: these whole words, consecutive, exact
  const n = clause.tokens.length;
  const ranges: Range[] = [];
  for (let i = 0; i + n <= f.whole.length; i++) {
    let ok = true;
    for (let k = 0; k < n && ok; k++) ok = f.whole[i + k].text === clause.tokens[k];
    if (ok) ranges.push([f.whole[i].start, f.whole[i + n - 1].end]);
  }
  return ranges.length ? { quality: 3, ranges } : null;
}

function passesFilters(g: Guideline, ix: Indexed, q: ParsedQuery): boolean {
  if (q.kinds.length && !q.kinds.includes(g.kind)) return false;
  if (q.notKinds.includes(g.kind)) return false;
  if (!q.tags.every((t) => ix.tags.includes(t))) return false;
  if (q.notTags.some((t) => ix.tags.includes(t))) return false;
  const byAuthor = (a: string) => (a.startsWith("0x") ? a.length >= 4 && ix.address.startsWith(a) : ix.handle === a);
  if (q.authors.length && !q.authors.some(byAuthor)) return false;
  if (q.notAuthors.some(byAuthor)) return false;
  return true;
}

// Excluded words match exactly (no prefix, no typos), so "-go" doesn't drop "google"
const excluded = (ix: Indexed, q: ParsedQuery) =>
  q.exclude.some((c) =>
    ix.fields.some((f) => {
      const m = matchClause(c, f, false);
      return m !== null && m.quality === 3;
    }),
  );

/** Long lines are cut to a window around the first hit, with "…" where text was cut. */
function trimLine(text: string, ranges: Range[]): { text: string; ranges: Range[] } {
  if (text.length <= LINE_MAX_CHARS) return { text, ranges };
  const first = ranges[0]?.[0] ?? 0;
  const start = Math.max(0, Math.min(first - 30, text.length - LINE_MAX_CHARS));
  const end = Math.min(text.length, start + LINE_MAX_CHARS);
  const lead = start > 0 ? "…" : "";
  const tail = end < text.length ? "…" : "";
  const shift = lead.length - start;
  const kept = ranges
    .filter(([s, e]) => e > start && s < end)
    .map(([s, e]) => [Math.max(s, start) + shift, Math.min(e, end) + shift] as Range);
  return { text: lead + text.slice(start, end) + tail, ranges: kept };
}

function evaluate(g: Guideline, q: ParsedQuery, maxLines: number): SearchHit | null {
  const ix = index(g);
  if (!passesFilters(g, ix, q) || excluded(ix, q)) return null;

  let score = 0;
  let exact = true;
  const titleRanges: Range[] = [];
  const descRanges: Range[] = [];
  const lines = new Map<number, { field: Field; ranges: Range[]; clauses: Set<number> }>();
  let titleClauses = 0;

  for (const [ci, clause] of q.include.entries()) {
    let best = 0;
    let bestNoTypo = 0;
    for (const f of ix.fields) {
      const m = matchClause(clause, f, true);
      if (!m) continue;
      const value = WEIGHT[f.name] * QUALITY_FACTOR[m.quality] * (clause.phrase ? PHRASE_FACTOR : 1);
      best = Math.max(best, value);
      if (m.quality > 1) bestNoTypo = Math.max(bestNoTypo, value);
      if (f.name === "title") {
        titleRanges.push(...m.ranges);
        if (m.quality > 1) titleClauses++;
      } else if (f.name === "description") descRanges.push(...m.ranges);
      else if (f.line !== undefined) {
        const entry = lines.get(f.line) ?? { field: f, ranges: [], clauses: new Set<number>() };
        entry.ranges.push(...m.ranges);
        entry.clauses.add(ci);
        lines.set(f.line, entry);
      }
    }
    if (best === 0) return null; // every word / phrase must match somewhere
    if (bestNoTypo === 0) exact = false;
    score += bestNoTypo || best;
  }
  if (q.include.length > 0 && titleClauses === q.include.length) score += TITLE_BONUS;

  const picked = [...lines.entries()]
    .sort(([la, a], [lb, b]) => b.clauses.size - a.clauses.size || WEIGHT[b.field.name] - WEIGHT[a.field.name] || la - lb)
    .slice(0, maxLines)
    .sort(([la], [lb]) => la - lb)
    .map(([line, e]) => ({ line, ...trimLine(e.field.text, mergeRanges(e.ranges)) }));

  return { guideline: g, score, exact, title: mergeRanges(titleRanges), description: mergeRanges(descRanges), lines: picked };
}

export function searchGuidelines(
  list: readonly Guideline[],
  input: string | ParsedQuery,
  options: { limit?: number; maxLines?: number } = {},
): SearchOutcome {
  const q = typeof input === "string" ? parseQuery(input) : input;
  const limit = Math.min(Math.max(Math.floor(options.limit ?? SEARCH_LIMIT_DEFAULT), 1), SEARCH_LIMIT_MAX);
  const maxLines = Math.min(Math.max(options.maxLines ?? 3, 0), 10);
  if (isEmptyQuery(q) && q.exclude.length === 0 && q.notKinds.length === 0 && q.notTags.length === 0 && q.notAuthors.length === 0) {
    return { hits: [], total: 0, warnings: q.warnings, query: q };
  }

  const hits = list
    .map((g) => evaluate(g, q, maxLines))
    .filter((h): h is SearchHit => h !== null)
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.score - a.score ||
        b.guideline.stars - a.guideline.stars ||
        a.guideline.title.localeCompare(b.guideline.title),
    );
  return { hits: hits.slice(0, limit), total: hits.length, warnings: q.warnings, query: q };
}
