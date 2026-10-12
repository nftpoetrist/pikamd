// Search query language, shared by the Explore search bar, /api/search and the MCP tool:
//   words            every word must match (title, tags, summary, author, file content…)
//   "exact phrase"   these words next to each other
//   -word  -"phrase" leave out guidelines that contain it
//   kind:skill       type filter (rules, skill, prompt, agent, guide); several = any of them
//   tag:react        tag filter; several = all of them
//   author:@devnull  author handle, or the start of a wallet address (author:0x1f9d)
//   -kind:… -tag:… -author:…  leave those out
// The filter buttons in the UI edit this text, so the query string is the single source of truth.
import type { GuidelineKind } from "@/lib/types";
import { fold, tokenize, words } from "./text.ts";

export const KINDS: readonly GuidelineKind[] = ["rules", "skill", "prompt", "agent", "guide"];
export const QUERY_MAX_LENGTH = 200;
const MAX_CLAUSES = 12;

/** A word or phrase as folded tokens; one token = a single word. */
export type Clause = { tokens: string[]; phrase: boolean; raw: string };

export type ParsedQuery = {
  include: Clause[];
  exclude: Clause[];
  kinds: GuidelineKind[];
  notKinds: GuidelineKind[];
  tags: string[];
  notTags: string[];
  authors: string[];
  notAuthors: string[];
  /** Problems worth telling the user, e.g. an unknown type. */
  warnings: string[];
};

type FilterKey = "kind" | "tag" | "author";

// "-?key:value" | "-?"phrase"" | "-?word"
const PART = /(-?)(?:(kind|tag|author):("[^"]*"|\S+)|"([^"]*)"?|(\S+))/gi;

const clean = (v: string) => v.replace(/^"|"$/g, "").trim();

export function parseQuery(input: string): ParsedQuery {
  const q: ParsedQuery = { include: [], exclude: [], kinds: [], notKinds: [], tags: [], notTags: [], authors: [], notAuthors: [], warnings: [] };
  const text = input.slice(0, QUERY_MAX_LENGTH);
  let clauses = 0;

  for (const m of text.matchAll(PART)) {
    if (++clauses > MAX_CLAUSES) {
      q.warnings.push(`Only the first ${MAX_CLAUSES} parts of the search are used`);
      break;
    }
    const negative = m[1] === "-";
    const key = m[2]?.toLowerCase() as FilterKey | undefined;

    if (key) {
      const value = fold(clean(m[3]));
      if (!value) continue;
      if (key === "kind") {
        // "rules" / "rule", "skill" / "skills"…: compare without a trailing s
        const singular = (w: string) => w.replace(/s$/, "");
        const kind = KINDS.find((k) => singular(k) === singular(value));
        if (!kind) {
          q.warnings.push(`Unknown type "${clean(m[3])}". Types: ${KINDS.join(", ")}`);
          // An impossible filter: nothing matches, rather than silently ignoring it
          if (!negative) q.kinds.push("__none__" as GuidelineKind);
          continue;
        }
        pushUnique(negative ? q.notKinds : q.kinds, kind);
      } else if (key === "tag") {
        pushUnique(negative ? q.notTags : q.tags, value.replace(/^#/, ""));
      } else {
        pushUnique(negative ? q.notAuthors : q.authors, value.replace(/^@/, ""));
      }
      continue;
    }

    const phrase = m[4] !== undefined;
    const raw = phrase ? m[4] : m[5];
    const tokens = words(tokenize(raw)).map((t) => t.text);
    if (tokens.length === 0) continue; // punctuation only, or an empty "" phrase
    const clause: Clause = { tokens, phrase: phrase || tokens.length > 1, raw: raw.trim() };
    (negative ? q.exclude : q.include).push(clause);
  }
  return q;
}

function pushUnique<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value);
}

export const isEmptyQuery = (q: ParsedQuery) =>
  q.include.length === 0 && q.kinds.length === 0 && q.tags.length === 0 && q.authors.length === 0;

// ── Editing the query text (filter buttons) ──

const filterPattern = (key: FilterKey, value: string) =>
  new RegExp(`(^|\\s)-?${key}:("?)${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\2(?=\\s|$)`, "i");

/** True if the query has `key:value` as an include filter. */
export function hasFilter(input: string, key: FilterKey, value: string): boolean {
  const q = parseQuery(input);
  const v = fold(value);
  if (key === "kind") return q.kinds.includes(v as GuidelineKind);
  if (key === "tag") return q.tags.includes(v);
  return q.authors.includes(v.replace(/^@/, ""));
}

/** Adds `key:value` to the query, or removes it (and any -key:value) if it's there. */
export function toggleFilter(input: string, key: FilterKey, value: string): string {
  const re = filterPattern(key, value);
  if (re.test(input)) return input.replace(new RegExp(re.source, "gi"), " ").replace(/\s+/g, " ").trim();
  const token = /\s/.test(value) ? `${key}:"${value}"` : `${key}:${value}`;
  return `${input.trim()} ${token}`.trim();
}
