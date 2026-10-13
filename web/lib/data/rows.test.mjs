// Supabase row → Guideline mapping (lib/data/rows.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowToGuideline } from "./rows.ts";

const row = {
  id: "7", slug: "secure-solidity", author_address: "0x9b2e7f1a4c8d3e6b5a0f2c9d7e1b4a8c3f6d0e77",
  title: "Secure Solidity", description: "d", kind: "rules", tags: ["solidity"], license: 0,
  latest_version: 3, uses_count: 5, stars_count: 12, content: "# hi",
};

test("maps a listed row to a Guideline", () => {
  assert.deepEqual(rowToGuideline(row), {
    id: 7, slug: "secure-solidity", title: "Secure Solidity", description: "d", kind: "rules", tags: ["solidity"],
    author: { address: "0x9b2e7f1A4C8D3E6B5a0f2C9D7E1b4A8C3F6d0E77" }, // checksummed for display
    license: "CC-BY-4.0", latestVersion: 3, stars: 12, uses: 5, content: "# hi",
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
