// Run: npm test  (node --experimental-strip-types --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchGuidelines } from "./engine.ts";
import { hasFilter, parseQuery, toggleFilter } from "./query.ts";
import { editDistance, fold, tokenize } from "./text.ts";
import { MOCK_GUIDELINES } from "../data/mock-guidelines.ts";

const slugs = (q, opts) => searchGuidelines(MOCK_GUIDELINES, q, opts).hits.map((h) => h.guideline.slug);
const hit = (q, slug) => searchGuidelines(MOCK_GUIDELINES, q).hits.find((h) => h.guideline.slug === slug);
const marked = (text, ranges) => ranges.map(([s, e]) => text.slice(s, e));

// ── text ──
test("folding removes case and accents, Turkish letters included", () => {
  assert.equal(fold("Çağ İĞNE ışık Ünlü"), "cag igne isik unlu");
  assert.equal(fold("Résumé"), "resume");
});

test("tokens keep original positions and split camelCase / letter-digit parts", () => {
  const t = tokenize("Don't wrap useMemo, v3 HTTPServer");
  const texts = t.map((x) => `${x.text}${x.sub ? "*" : ""}`);
  assert.deepEqual(texts, ["don", "t", "wrap", "usememo", "use*", "memo*", "v3", "v*", "3*", "httpserver", "http*", "server*"]);
  const memo = t.find((x) => x.text === "memo");
  assert.equal("Don't wrap useMemo, v3 HTTPServer".slice(memo.start, memo.end), "Memo");
});

test("edit distance counts swaps as one edit and stops early", () => {
  assert.equal(editDistance("solidity", "solidity", 2), 0);
  assert.equal(editDistance("solidty", "solidity", 1), 1);
  assert.equal(editDistance("soldiity", "solidity", 1), 1); // transposition
  assert.equal(editDistance("abcdef", "uvwxyz", 1), 2); // capped at max + 1
});

// ── query language ──
test("query syntax: words, phrases, exclusions and filters", () => {
  const q = parseQuery('react "stable keys" -redux kind:rules tag:React -tag:css author:@DevNull -author:0x9b2e');
  assert.deepEqual(q.include.map((c) => c.tokens), [["react"], ["stable", "keys"]]);
  assert.equal(q.include[1].phrase, true);
  assert.deepEqual(q.exclude.map((c) => c.tokens), [["redux"]]);
  assert.deepEqual(q.kinds, ["rules"]);
  assert.deepEqual(q.tags, ["react"]);
  assert.deepEqual(q.notTags, ["css"]);
  assert.deepEqual(q.authors, ["devnull"]);
  assert.deepEqual(q.notAuthors, ["0x9b2e"]);
  assert.deepEqual(q.warnings, []);
});

test("kind accepts plural/singular and warns on unknown types", () => {
  assert.deepEqual(parseQuery("kind:skills").kinds, ["skill"]);
  assert.deepEqual(parseQuery("kind:rule").kinds, ["rules"]);
  const bad = parseQuery("kind:banana");
  assert.equal(bad.warnings.length, 1);
  assert.deepEqual(slugs("kind:banana"), []); // an unknown type matches nothing, not everything
});

test("hyphenated words are phrases; punctuation-only parts are ignored", () => {
  assert.deepEqual(parseQuery("checks-effects-interactions").include[0], { tokens: ["checks", "effects", "interactions"], phrase: true, raw: "checks-effects-interactions" });
  assert.deepEqual(parseQuery("!!! ---").include, []);
});

test("filter buttons add and remove filters in the query text", () => {
  assert.equal(toggleFilter("react", "kind", "rules"), "react kind:rules");
  assert.equal(toggleFilter("react kind:rules", "kind", "rules"), "react");
  assert.equal(toggleFilter("kind:rules react -kind:rules", "kind", "rules"), "react");
  assert.equal(toggleFilter("", "tag", "a11y"), "tag:a11y");
  assert.ok(hasFilter("x tag:A11y", "tag", "a11y"));
  assert.ok(!hasFilter("x -tag:a11y", "tag", "a11y"));
  // A filter value that is a prefix of another isn't touched
  assert.equal(toggleFilter("tag:reactive", "tag", "react"), "tag:reactive tag:react");
});

// ── matching ──
test("words match at word starts, not inside words", () => {
  assert.ok(slugs("memo").includes("react-performance")); // useMemo, memoize
  assert.ok(!slugs("ntrancy").includes("secure-solidity")); // inside "reentrancy": no
  assert.ok(slugs("reentran").includes("secure-solidity")); // prefix: yes
});

test("every word must match; exclusions drop guidelines", () => {
  assert.deepEqual(slugs("react solidity"), []);
  assert.ok(slugs("react").includes("react-performance"));
  assert.ok(!slugs("react -memoize").includes("react-performance"));
});

test("phrases need the words side by side", () => {
  assert.ok(slugs('"checks effects interactions"').includes("secure-solidity"));
  assert.ok(slugs("checks-effects-interactions").includes("secure-solidity"));
  assert.ok(!slugs('"interactions effects"').includes("secure-solidity"));
});

test("typos on longer words still find the guideline, ranked after exact matches", () => {
  assert.equal(slugs("solidty")[0], "secure-solidity");
  assert.equal(hit("solidty", "secure-solidity").exact, false);
  assert.equal(hit("solidity", "secure-solidity").exact, true);
  // Typo tolerance starts at 5 letters: "raect" (5) finds React, "raec" (4) doesn't
  assert.equal(hit("raect", "react-performance")?.exact, false);
  assert.ok(!slugs("raec").includes("react-performance"));
});

test("an exact match in the text beats a typo match in the title", () => {
  const base = MOCK_GUIDELINES[0];
  const typoTitle = { ...base, slug: "typo", title: "Solidyty Notes", description: "x", tags: [], content: "nothing here" };
  const exactText = { ...base, slug: "exact", title: "Contracts", description: "y", tags: [], content: "use solidity carefully" };
  const r = searchGuidelines([typoTitle, exactText], "solidity").hits.map((h) => h.guideline.slug);
  assert.deepEqual(r, ["exact", "typo"]);
});

test("title hits outrank content-only hits", () => {
  const r = slugs("solidity");
  assert.equal(r[0], "secure-solidity");
});

test("filters: type, tags (all), author handle or address start", () => {
  assert.ok(slugs("kind:skill").every((s) => MOCK_GUIDELINES.find((g) => g.slug === s).kind === "skill"));
  assert.equal(slugs("kind:skill").length, MOCK_GUIDELINES.filter((g) => g.kind === "skill").length);
  assert.deepEqual(slugs("tag:react tag:nextjs"), ["nextjs-app-router"]);
  assert.deepEqual(slugs("author:@devnull"), ["nextjs-app-router"]);
  assert.deepEqual(slugs("author:0x3e6b9d"), ["react-performance"]);
  assert.deepEqual(slugs("author:0x3"), []); // too short to be an address filter
  assert.ok(!slugs("kind:rules -tag:react", { limit: 25 }).some((s) => ["react-performance", "nextjs-app-router"].includes(s)));
});

test("hits highlight the title and list matching file lines with numbers", () => {
  const h = hit("reentrancy", "secure-solidity");
  assert.ok(h.lines.length >= 1);
  const line = h.lines[0];
  const source = h.guideline.content.split("\n")[line.line - 1];
  assert.ok(source.includes(line.text.replace(/^…|…$/g, "")));
  assert.deepEqual(marked(line.text, line.ranges).map((s) => s.toLowerCase()), ["reentrancy"]);

  const t = hit("solidity", "secure-solidity");
  assert.deepEqual(marked(t.guideline.title, t.title), ["Solidity"]);
});

test("at most N lines per hit, in file order", () => {
  const h = searchGuidelines(MOCK_GUIDELINES, "the", { maxLines: 2 }).hits[0];
  assert.ok(h.lines.length <= 2);
  assert.ok(h.lines.every((l, i, a) => i === 0 || a[i - 1].line < l.line));
});

test("limit and total", () => {
  const all = searchGuidelines(MOCK_GUIDELINES, "kind:rules", { limit: 3 });
  assert.equal(all.hits.length, 3);
  assert.equal(all.total, MOCK_GUIDELINES.filter((g) => g.kind === "rules").length);
  assert.equal(searchGuidelines(MOCK_GUIDELINES, "kind:rules", { limit: 999 }).hits.length, Math.min(25, all.total));
});

test("an empty query returns nothing; very long input is cut", () => {
  assert.equal(searchGuidelines(MOCK_GUIDELINES, "   ").total, 0);
  assert.doesNotThrow(() => searchGuidelines(MOCK_GUIDELINES, "a ".repeat(5000)));
});

test("long lines are cut around the hit and ranges still point at it", () => {
  const long = { ...MOCK_GUIDELINES[0], slug: "long", content: `${"x ".repeat(120)}needle${" y".repeat(120)}` };
  const h = searchGuidelines([long], "needle").hits[0];
  const l = h.lines[0];
  assert.ok(l.text.startsWith("…") && l.text.endsWith("…") && l.text.length <= 113);
  assert.deepEqual(marked(l.text, l.ranges), ["needle"]);
});

test("search reads the first 100 KB of a file", async () => {
  const { SEARCH_CONTENT_MAX } = await import("./engine.ts");
  const filler = "lorem ipsum dolor\n".repeat(Math.ceil(SEARCH_CONTENT_MAX / 18));
  const g = { ...MOCK_GUIDELINES[0], id: 4242, slug: "huge-file", content: `early-marker\n${filler}late-marker\n` };
  assert.equal(searchGuidelines([g], "early-marker").total, 1);
  assert.equal(searchGuidelines([g], "late-marker").total, 0, "past the limit");
  // A fresh copy of the same guideline (as each request gets) still finds the same things
  assert.equal(searchGuidelines([{ ...g }], "early-marker").total, 1);
});
