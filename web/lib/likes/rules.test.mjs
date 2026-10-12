// Run: npm test  (node --experimental-strip-types --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideLike, pikagoldFor, sameWallet } from "./rules.ts";

const ALICE = "0x7a3c9e2b41d05f8a6c1e93b7d2f4a8c6e5b1f021";
const BOB = "0x1f9d4c7a20b8e6f3d5a9c2e1b7f04d8a3c6e2b55";
const guidelines = [
  { slug: "a1", author: { address: ALICE } },
  { slug: "a2", author: { address: ALICE } },
  { slug: "b1", author: { address: BOB } },
];

test("liking needs a session wallet and a known guideline", () => {
  const known = new Set(["a1"]);
  assert.deepEqual(decideLike(null, "a1", known), { ok: false, status: 401, error: "Sign in with your wallet to like guidelines" });
  assert.equal(decideLike(BOB, "nope", known).ok, false);
  assert.deepEqual(decideLike(BOB, "a1", known), { ok: true });
});

test("authors may like their own guideline", () => {
  assert.deepEqual(decideLike(ALICE, "a1", new Set(["a1"])), { ok: true });
});

test("PikaGold is the sum of likes on the author's guidelines", () => {
  const counts = new Map([["a1", 10], ["a2", 3], ["b1", 7]]);
  assert.equal(pikagoldFor(ALICE, guidelines, counts), 13);
  assert.equal(pikagoldFor(ALICE.toUpperCase().replace("0X", "0x"), guidelines, counts), 13);
  assert.equal(pikagoldFor(BOB, guidelines, counts), 7);
  assert.equal(pikagoldFor("0x0000000000000000000000000000000000000001", guidelines, counts), 0);
  assert.equal(pikagoldFor(ALICE, guidelines, new Map()), 0);
});

test("wallets compare without case", () => {
  assert.ok(sameWallet(ALICE, ALICE.toUpperCase().replace("0X", "0x")));
  assert.ok(!sameWallet(ALICE, BOB));
});
