// Reads a registration out of an Arc transaction receipt (ARCHITECTURE §7.1, step 7). The server
// trusts only what the chain says: the transaction succeeded, it went to our registry, our registry
// emitted GuidelineRegistered, and its author (the contract's msg.sender) is the signed-in wallet.
// Not the receipt's `from` or `to`: with a smart-contract wallet a bundler sends the transaction to
// the ERC-4337 EntryPoint. Only events emitted by the registry's own address count.
// Pure, so it runs in tests.
import { parseEventLogs, type Log } from "viem";
import { REGISTRY_ABI } from "../registry-abi.ts";

export type Registration = {
  id: bigint;
  author: `0x${string}`;
  parentId: bigint;
  cid: string;
  contentHash: `0x${string}`;
  license: number;
  txHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};

type ReceiptLike = {
  status: "success" | "reverted";
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  logs: Log[];
};

const same = (a: string | null | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();

export function readRegistration(receipt: ReceiptLike, registry: `0x${string}`, wallet: `0x${string}`): Registration | { error: string } {
  if (receipt.status !== "success") return { error: "The transaction failed on Arc" };

  const events = parseEventLogs({
    abi: REGISTRY_ABI,
    eventName: "GuidelineRegistered",
    logs: receipt.logs.filter((l) => same(l.address, registry)),
  });
  if (events.length !== 1) return { error: "No registration found in this transaction" };
  const [e] = events;
  if (!same(e.args.author, wallet)) return { error: "The guideline was registered by another wallet" };

  return {
    id: e.args.id,
    author: e.args.author,
    parentId: e.args.parentId,
    cid: e.args.cid,
    contentHash: e.args.contentHash,
    license: e.args.license,
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    logIndex: e.logIndex ?? 0,
  };
}

export type HiddenChange = { id: bigint; hidden: boolean; txHash: `0x${string}`; blockNumber: bigint };

/**
 * What a setHidden transaction changed (My Collection → Shared by me): the registry's own HiddenSet
 * event, exactly one. The contract only lets a guideline's author call setHidden, and the server
 * still checks the author on the chain before it changes the index.
 */
export function readHiddenChange(receipt: ReceiptLike, registry: `0x${string}`): HiddenChange | { error: string } {
  if (receipt.status !== "success") return { error: "The transaction failed on Arc" };
  const events = parseEventLogs({
    abi: REGISTRY_ABI,
    eventName: "HiddenSet",
    logs: receipt.logs.filter((l) => same(l.address, registry)),
  });
  if (events.length !== 1) return { error: "No hide or show change found in this transaction" };
  const [e] = events;
  return { id: e.args.id, hidden: e.args.hidden, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
}

export type LockChange = { id: bigint; locked: boolean; moderator: `0x${string}`; txHash: `0x${string}`; blockNumber: bigint };

/**
 * What a setModeratorLock transaction changed (/mod): the registry's own ModeratorLockSet event,
 * exactly one. Only a wallet holding MODERATOR_ROLE can emit it, and the event names that wallet.
 */
export function readLockChange(receipt: ReceiptLike, registry: `0x${string}`): LockChange | { error: string } {
  if (receipt.status !== "success") return { error: "The transaction failed on Arc" };
  const events = parseEventLogs({
    abi: REGISTRY_ABI,
    eventName: "ModeratorLockSet",
    logs: receipt.logs.filter((l) => same(l.address, registry)),
  });
  if (events.length !== 1) return { error: "No lock change found in this transaction" };
  const [e] = events;
  return { id: e.args.id, locked: e.args.locked, moderator: e.args.moderator, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber };
}
