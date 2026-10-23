// Reviewed badge: GuidelineReviews events and MODERATOR_ROLE changes → index rows (events.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeEventTopics, keccak256, toBytes } from "viem";
import { MODERATOR_ROLE, moderatorRoleEvents, readReviews, reviewEvents } from "./events.ts";
import { REVIEWS_ABI } from "../reviews-abi.ts";
import { REGISTRY_ABI } from "../registry-abi.ts";

const REVIEWS = "0x" + "1".repeat(40);
const REGISTRY = "0x" + "2".repeat(40);
const MOD = "0x" + "9".repeat(40);
const OTHER = "0x" + "8".repeat(40);
const HASH = "0x" + "c".repeat(64);
const TX = "0x" + "f".repeat(64);

const reviewedLog = ({ id = 4n, version = 1, block = 10n, logIndex = 0, address = REVIEWS } = {}) => ({
  address,
  topics: encodeEventTopics({ abi: REVIEWS_ABI, eventName: "Reviewed", args: { id, reviewer: MOD } }),
  data: encodeAbiParameters([{ type: "uint32" }, { type: "bytes32" }], [version, HASH]),
  logIndex, blockNumber: block, transactionHash: TX,
});
const revokedLog = ({ id = 4n, version = 1, block = 11n, logIndex = 0 } = {}) => ({
  address: REVIEWS,
  topics: encodeEventTopics({ abi: REVIEWS_ABI, eventName: "ReviewRevoked", args: { id, moderator: OTHER } }),
  data: encodeAbiParameters([{ type: "uint32" }], [version]),
  logIndex, blockNumber: block, transactionHash: TX,
});
const roleLog = (eventName, role, account, block, logIndex = 0) => ({
  address: REGISTRY,
  topics: encodeEventTopics({ abi: REGISTRY_ABI, eventName, args: { role, account, sender: MOD } }),
  data: "0x", logIndex, blockNumber: block, transactionHash: TX,
});

test("the moderator role is the registry's keccak256(\"MODERATOR_ROLE\")", () => {
  assert.equal(MODERATOR_ROLE, keccak256(toBytes("MODERATOR_ROLE")));
});

test("approvals and revokes are read in chain order, from our contract only", () => {
  const events = reviewEvents([revokedLog({ block: 12n }), reviewedLog({ address: OTHER }), reviewedLog({ block: 10n, logIndex: 3 }), reviewedLog({ id: 5n, block: 10n, logIndex: 1 })], REVIEWS.toUpperCase().replace("0X", "0x"));
  assert.deepEqual(events.map((e) => [e.guidelineId, e.reviewed, e.logIndex]), [[5n, true, 1], [4n, true, 3], [4n, false, 0]]);
  assert.deepEqual(events[1], { guidelineId: 4n, reviewed: true, version: 1, contentHash: HASH, moderator: MOD, txHash: TX, blockNumber: 10n, logIndex: 3 });
  assert.deepEqual(events[2], { guidelineId: 4n, reviewed: false, version: 1, contentHash: null, moderator: OTHER, txHash: TX, blockNumber: 12n, logIndex: 0 });
});

test("a review transaction must have succeeded and hold a review", () => {
  const receipt = (logs, status = "success") => ({ status, transactionHash: TX, blockNumber: 99n, logs });
  assert.deepEqual(readReviews(receipt([reviewedLog()]), REVIEWS).map((r) => [r.reviewed, r.blockNumber]), [[true, 99n]]);
  assert.deepEqual(readReviews(receipt([reviewedLog()], "reverted"), REVIEWS), { error: "The transaction failed on Arc" });
  assert.deepEqual(readReviews(receipt([reviewedLog({ address: OTHER })]), REVIEWS), { error: "No review found in this transaction" });
});

test("only MODERATOR_ROLE changes on the registry count", () => {
  const admin = "0x" + "0".repeat(64); // DEFAULT_ADMIN_ROLE
  const events = moderatorRoleEvents(
    [
      roleLog("RoleRevoked", MODERATOR_ROLE, OTHER, 21n),
      roleLog("RoleGranted", MODERATOR_ROLE, OTHER, 20n),
      roleLog("RoleGranted", admin, OTHER, 20n, 1),
      { ...roleLog("RoleRevoked", MODERATOR_ROLE, MOD, 22n), address: REVIEWS },
    ],
    REGISTRY,
  );
  assert.deepEqual(events, [
    { account: OTHER, hasRole: true, blockNumber: 20n, logIndex: 0 },
    { account: OTHER, hasRole: false, blockNumber: 21n, logIndex: 0 },
  ]);
});
