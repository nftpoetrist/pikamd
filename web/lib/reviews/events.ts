// Reviewed badge (ARCHITECTURE §9.5): GuidelineReviews' events, and the registry's
// MODERATOR_ROLE changes, → what the index stores. Only logs emitted by the contract's own address
// count, in chain order (block, then log index). Pure, so it runs in tests.
import { keccak256, parseEventLogs, toBytes, type Log } from "viem";
import { REGISTRY_ABI } from "../registry-abi.ts";
import { REVIEWS_ABI } from "../reviews-abi.ts";

export type ReviewEvent = {
  guidelineId: bigint;
  /** false: the moderator took the approval back */
  reviewed: boolean;
  version: number;
  /** the approved version's hash; null for a revoke (the event doesn't carry it) */
  contentHash: `0x${string}` | null;
  /** who approved, or who revoked */
  moderator: `0x${string}`;
  txHash: `0x${string}`;
  blockNumber: bigint;
  logIndex: number;
};

export type RoleEvent = { account: `0x${string}`; hasRole: boolean; blockNumber: bigint; logIndex: number };

type ReceiptLike = { status: "success" | "reverted"; transactionHash: `0x${string}`; blockNumber: bigint; logs: Log[] };

/** GuidelineRegistry.MODERATOR_ROLE */
export const MODERATOR_ROLE = keccak256(toBytes("MODERATOR_ROLE"));

const same = (a: string | null | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();
const byChainOrder = (a: { blockNumber: bigint | null; logIndex: number | null }, b: { blockNumber: bigint | null; logIndex: number | null }) =>
  a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : a.blockNumber! < b.blockNumber! ? -1 : 1;

/** Every approval and revoke the reviews contract emitted in these logs, oldest first. */
export function reviewEvents(logs: Log[], reviews: `0x${string}`): ReviewEvent[] {
  const events = parseEventLogs({ abi: REVIEWS_ABI, logs: logs.filter((l) => same(l.address, reviews)), strict: true });
  events.sort(byChainOrder);
  const out: ReviewEvent[] = [];
  for (const e of events) {
    const at = { txHash: e.transactionHash!, blockNumber: e.blockNumber!, logIndex: e.logIndex ?? 0 };
    if (e.eventName === "Reviewed") {
      out.push({ guidelineId: e.args.id, reviewed: true, version: e.args.version, contentHash: e.args.contentHash, moderator: e.args.reviewer, ...at });
    } else if (e.eventName === "ReviewRevoked") {
      out.push({ guidelineId: e.args.id, reviewed: false, version: e.args.version, contentHash: null, moderator: e.args.moderator, ...at });
    }
  }
  return out;
}

/** The review events in one transaction (POST /api/mod/review): it must have succeeded and hold one. */
export function readReviews(receipt: ReceiptLike, reviews: `0x${string}`): ReviewEvent[] | { error: string } {
  if (receipt.status !== "success") return { error: "The transaction failed on Arc" };
  const found = reviewEvents(receipt.logs, reviews).map((r) => ({ ...r, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber }));
  if (found.length === 0) return { error: "No review found in this transaction" };
  return found;
}

/** MODERATOR_ROLE grants and revokes on the registry, oldest first (other roles are ignored). */
export function moderatorRoleEvents(logs: Log[], registry: `0x${string}`): RoleEvent[] {
  const events = parseEventLogs({ abi: REGISTRY_ABI, logs: logs.filter((l) => same(l.address, registry)), strict: true });
  events.sort(byChainOrder);
  const out: RoleEvent[] = [];
  for (const e of events) {
    if ((e.eventName === "RoleGranted" || e.eventName === "RoleRevoked") && same(e.args.role, MODERATOR_ROLE)) {
      out.push({ account: e.args.account, hasRole: e.eventName === "RoleGranted", blockNumber: e.blockNumber!, logIndex: e.logIndex ?? 0 });
    }
  }
  return out;
}
