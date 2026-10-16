import "server-only";
import type { TipEvent } from "@/lib/tips/events";
import { check, supabase } from "@/lib/server/supabase";

// The index's copy of GuidelineTips' Tipped events (web/supabase/migrations/20261016090000_tips.sql).
// Both writers, POST /api/tips/record and the indexer, pass events read from Arc only.

type Row = Record<string, string | number>;

const toRow = (t: TipEvent): Row => ({
  tx_hash: t.txHash.toLowerCase(),
  log_index: t.logIndex,
  block_number: t.blockNumber.toString(),
  guideline_id: t.guidelineId.toString(),
  from_address: t.from.toLowerCase(),
  author_address: t.author.toLowerCase(),
  amount: t.amount.toString(), // numeric(78, 0): sent as text, never through a float
});

/** Stores the events; ones already stored are left as they are. Returns how many were new. */
export async function recordTips(events: TipEvent[]): Promise<number> {
  const db = supabase();
  if (!db) throw new Error("Tips aren't recorded without a database");
  if (events.length === 0) return 0;
  const insert = (rows: Row[]) => db.from("tips").upsert(rows, { onConflict: "tx_hash,log_index", ignoreDuplicates: true }).select("tx_hash");

  const rows = events.map(toRow);
  const res = await insert(rows);
  if (!res.error?.code?.startsWith("23")) return check(res, "record tips")?.length ?? 0;

  // A row the table's checks refuse fails every time the same way (the contract already enforces
  // those rules, so it shouldn't happen): store the others one by one and report it, so a single
  // bad event never stalls the indexer. Anything else is thrown and retried.
  let added = 0;
  for (const row of rows) {
    const one = await insert([row]);
    if (one.error?.code?.startsWith("23")) {
      console.error(`[tips] ${row.tx_hash}#${row.log_index} can't be indexed: ${one.error.code} ${one.error.message}`);
      continue;
    }
    added += check(one, "record tip")?.length ?? 0;
  }
  return added;
}
