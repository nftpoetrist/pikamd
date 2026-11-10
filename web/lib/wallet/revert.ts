import { BaseError, ContractFunctionRevertedError } from "viem";

// Contract calls are simulated (eth_call, free) before the wallet is asked to send them
// (ARCHITECTURE §5.2, item 6): a call Arc would refuse is explained instead of sent and paid for.

/** The custom error a simulated contract call reverted with (e.g. "NotAuthor"), or null. */
export function revertName(error: unknown): string | null {
  if (!(error instanceof BaseError)) return null;
  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
  return revert instanceof ContractFunctionRevertedError ? (revert.data?.errorName ?? null) : null;
}

/** True when the error is a revert found before anything was sent (a simulation). */
export const isRevert = (error: unknown) => {
  if (!(error instanceof BaseError)) return false;
  return error.walk((e) => e instanceof ContractFunctionRevertedError) instanceof ContractFunctionRevertedError;
};

/** Messages for the registry's and the review contract's errors (contracts/src). */
const MESSAGES: Record<string, string> = {
  NotAuthor: "Only the author's wallet can change this guideline",
  LockedByModerator: "A moderator locked this guideline on Arc, so it can't change",
  UnknownGuideline: "Arc has no record of this guideline",
  AccessControlUnauthorizedAccount: "This wallet isn't a PikaMd moderator on Arc",
  NotModerator: "This wallet isn't a PikaMd moderator on Arc",
  NotReviewed: "There's no approval on Arc to take back",
  EmptyCid: "Arc would refuse this registration (the file has no IPFS address)",
  CidTooLong: "Arc would refuse this registration (the IPFS address is too long)",
  EmptyContentHash: "Arc would refuse this registration (the file has no hash)",
  UnknownLicense: "Arc would refuse this registration (unknown license)",
};

/** A message for a revert found in a simulation, or null when the error is something else. */
export function revertMessage(error: unknown): string | null {
  if (!isRevert(error)) return null;
  const name = revertName(error);
  const text = (name && MESSAGES[name]) || `Arc would refuse this transaction${name ? ` (${name})` : ""}`;
  return `${text}. Nothing was sent`;
}
