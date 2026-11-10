import assert from "node:assert/strict";
import { test } from "node:test";
import { ContractFunctionExecutionError, ContractFunctionRevertedError, encodeErrorResult } from "viem";
import { REGISTRY_ABI } from "../registry-abi.ts";
import { REVIEWS_ABI } from "../reviews-abi.ts";
import { revertMessage, revertName } from "./revert.ts";

const REGISTRY = "0x27cf926771B0A311A9574543ea29dc5e3ea59986";
const CALLER = "0x0000000000000000000000000000000000000abc";

/** The error viem's simulateContract throws when the contract reverts with a custom error. */
function simulated(abi, errorName, args, functionName) {
  const data = encodeErrorResult({ abi, errorName, args });
  const cause = new ContractFunctionRevertedError({ abi, data, functionName });
  return new ContractFunctionExecutionError(cause, { abi, functionName, args: [], contractAddress: REGISTRY });
}

test("a registry revert found in a simulation becomes a plain message", () => {
  const e = simulated(REGISTRY_ABI, "NotAuthor", [5n, CALLER], "setHidden");
  assert.equal(revertName(e), "NotAuthor");
  assert.equal(revertMessage(e), "Only the author's wallet can change this guideline. Nothing was sent");
});

test("a moderator lock and a missing role are named", () => {
  assert.match(revertMessage(simulated(REGISTRY_ABI, "LockedByModerator", [7n], "setHidden")), /locked this guideline/);
  const role = simulated(REGISTRY_ABI, "AccessControlUnauthorizedAccount", [CALLER, "0x" + "00".repeat(32)], "setModeratorLock");
  assert.match(revertMessage(role), /isn't a PikaMd moderator/);
  assert.match(revertMessage(simulated(REVIEWS_ABI, "NotReviewed", [3n], "revoke")), /no approval/);
});

test("anything that isn't a revert is left to the caller", () => {
  assert.equal(revertMessage(new Error("User rejected the request")), null);
  assert.equal(revertName(new Error("x")), null);
  assert.equal(revertMessage(null), null);
});
