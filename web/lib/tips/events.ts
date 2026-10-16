// GuidelineTips' Tipped events → tips for the index (K21). Only logs emitted by the tips contract's
// own address count, in chain order (block, then log index). Who tipped whom, for which guideline
// and how much all come from the event, which the contract emits only when the USDC moved: the
// author in it is the registry's author at that moment. Pure, so it runs in tests.
import { parseEventLogs, type Log } from "viem";
import { TIPS_ABI } from "../tips-abi.ts";

export type TipEvent = {
  guidelineId: bigint;
  from: `0x${string}`;
  author: `0x${string}`;
  /** USDC units, 6 decimals */
  amount: bigint;
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

/** Every Tipped event the tips contract emitted in these logs, oldest first. */
export function tipEvents(logs: Log[], tips: `0x${string}`): TipEvent[] {
  const events = parseEventLogs({ abi: TIPS_ABI, eventName: "Tipped", logs: logs.filter((l) => same(l.address, tips)), strict: true });
  events.sort((a, b) => (a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : a.blockNumber! < b.blockNumber! ? -1 : 1));
  return events.map((e) => ({
    guidelineId: e.args.guidelineId,
    from: e.args.from,
    author: e.args.author,
    amount: e.args.amount,
    txHash: e.transactionHash!,
    blockNumber: e.blockNumber!,
    logIndex: e.logIndex ?? 0,
  }));
}

/** The tips in one transaction (POST /api/tips/record): it must have succeeded and hold at least one. */
export function readTips(receipt: ReceiptLike, tips: `0x${string}`): TipEvent[] | { error: string } {
  if (receipt.status !== "success") return { error: "The transaction failed on Arc" };
  const found = tipEvents(receipt.logs, tips).map((t) => ({ ...t, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber }));
  if (found.length === 0) return { error: "No tip found in this transaction" };
  return found;
}
