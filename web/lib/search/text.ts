// Text helpers for search: case and accent folding with a map back to the original string,
// and word tokens (with camelCase / letter-digit sub-words) carrying their original positions.
// Pure, no imports: shared by the site (/api/search) and the MCP server.

export type Range = [start: number, end: number]; // [start, end) in the ORIGINAL string

export type Token = {
  /** Folded text: lowercase, no accents. */
  text: string;
  start: number;
  end: number;
  /** A part of a word (camelCase, letter↔digit), not a whole word. */
  sub: boolean;
};

/** One character folded: lowercase, accents removed, Turkish dotless ı → i. */
function foldChar(c: string): string {
  if (c === "ı" || c === "I") return "i";
  return c.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
}

/** Folds a string for comparison: "Çağ İÖ" → "cag io". */
export function fold(s: string): string {
  let out = "";
  for (const c of s) out += foldChar(c);
  return out;
}

const WORD = /[\p{L}\p{N}]+/gu;
// Boundaries inside a word: fooBar, HTTPServer → HTTP|Server, v3 / 0x… letter↔digit
const SUB_SPLIT = /(?<=\p{Ll})(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})|(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/u;

/** Whole words in order, each followed by its sub-words (if it has more than one). */
export function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  for (const m of s.matchAll(WORD)) {
    const word = m[0];
    const start = m.index;
    tokens.push({ text: fold(word), start, end: start + word.length, sub: false });
    const parts = word.split(SUB_SPLIT);
    if (parts.length > 1) {
      let at = start;
      for (const part of parts) {
        tokens.push({ text: fold(part), start: at, end: at + part.length, sub: true });
        at += part.length;
      }
    }
  }
  return tokens;
}

/** Whole-word tokens only (for phrases: consecutive words). */
export const words = (tokens: Token[]) => tokens.filter((t) => !t.sub);

/**
 * Damerau–Levenshtein distance (optimal string alignment), stopping early once it's
 * certainly above `max`. Used for typo tolerance on longer words only.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev2 = new Array<number>(cols).fill(0);
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const cur = new Array<number>(cols);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[cols - 1];
}

/** Sorted, merged ranges (overlapping or touching ranges become one). */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}
