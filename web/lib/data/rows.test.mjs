// Supabase row → Guideline mapping (lib/data/rows.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { forAgents, rowToGuideline } from "./rows.ts";

const row = {
  id: "7", slug: "secure-solidity", author_address: "0x9b2e7f1a4c8d3e6b5a0f2c9d7e1b4a8c3f6d0e77",
  title: "Secure Solidity", description: "d", kind: "rules", tags: ["solidity"], license: 0,
  latest_version: 3, uses_count: 5, stars_count: 12, content: "# hi",
};

test("maps a listed row to a Guideline", () => {
  assert.deepEqual(rowToGuideline(row), {
    id: 7, slug: "secure-solidity", title: "Secure Solidity", description: "d", kind: "rules", tags: ["solidity"],
    author: { address: "0x9b2e7f1A4C8D3E6B5a0f2C9D7E1b4A8C3F6d0E77" }, // checksummed for display
    license: "CC-BY-4.0", latestVersion: 3, stars: 12, uses: 5, content: "# hi", flagged: false,
  });
});

test("rows that don't fit are refused, not guessed", () => {
  assert.equal(rowToGuideline({ ...row, kind: "script" }), null);
  assert.equal(rowToGuideline({ ...row, license: 1 }), null, "license id the app doesn't know yet");
  assert.equal(rowToGuideline({ ...row, author_address: "0x123" }), null);
  assert.equal(rowToGuideline({ ...row, id: "0" }), null);
  assert.equal(rowToGuideline({ ...row, id: "9007199254740993" }), null, "beyond safe integers");
});

test("missing tags and counts become empty / zero", () => {
  const g = rowToGuideline({ ...row, tags: null, stars_count: null, uses_count: undefined });
  assert.deepEqual([g.tags, g.stars, g.uses], [[], 0, 0]);
});

test("flagged guidelines are marked, and agents never get them", () => {
  const flagged = rowToGuideline({ ...row, slug: "risky", scan_status: "suspicious" });
  const warned = rowToGuideline({ ...row, slug: "warned", scan_status: "warning" });
  const clean = rowToGuideline({ ...row, scan_status: "clean" });
  assert.equal(flagged.flagged, true);
  assert.equal(warned.flagged, false, "kept personal data is not a moderation flag");
  assert.deepEqual(forAgents([flagged, warned, clean]).map((g) => g.slug), ["warned", "secure-solidity"]);
});

test("the on-chain record comes along when the row has it", () => {
  const tx = "0x" + "a".repeat(64);
  const hash = "0x" + "b".repeat(64);
  assert.deepEqual(rowToGuideline({ ...row, cid: "bafyX", content_hash: hash, tx_hash: tx }).record, { txHash: tx, cid: "bafyX", contentHash: hash });
  assert.equal(rowToGuideline({ ...row, cid: "bafyX", content_hash: "0x12", tx_hash: tx }).record, undefined, "malformed hash: no record");
  assert.equal(rowToGuideline(row).record, undefined);
});

test("card rows map without the file, with the same checks", async () => {
  const { CARD_COLUMNS, GUIDELINE_COLUMNS, rowToCard } = await import("./rows.ts");
  const { content, ...card } = row;
  void content;
  const g = rowToCard(card);
  assert.deepEqual([g.id, g.slug, g.stars, "content" in g], [7, "secure-solidity", 12, false]);
  assert.equal(rowToCard({ ...card, kind: "script" }), null);
  assert.ok(!CARD_COLUMNS.split(", ").includes("content"), "card lists never fetch files");
  assert.deepEqual(GUIDELINE_COLUMNS.split(", ").sort(), [...CARD_COLUMNS.split(", "), "content"].sort());
});

test("the author's own rows keep both flags and never carry the file", async () => {
  const { rowToOwned } = await import("./rows.ts");
  const { content, ...card } = row;
  void content;
  const g = rowToOwned({ ...card, author_hidden: true, moderator_locked: false });
  assert.deepEqual([g.hidden, g.locked, g.slug, "content" in g], [true, false, "secure-solidity", false]);
  assert.equal(rowToOwned({ ...card, author_hidden: null, moderator_locked: false }), null, "a missing flag is not read as listed");
  assert.equal(rowToOwned({ ...card, author_hidden: false, moderator_locked: "no" }), null);
  assert.equal(rowToOwned({ ...card, kind: "script", author_hidden: false, moderator_locked: false }), null);
});
