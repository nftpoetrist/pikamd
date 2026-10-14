import "server-only";
import { revalidateTag } from "next/cache";
import { CHAIN, REGISTRY } from "@/lib/chain";
import { GUIDELINES_TAG } from "@/lib/data/guidelines";
import { registryActions } from "@/lib/registry-events";
import { arcClient } from "@/lib/server/auth";
import { confirmRegistration } from "@/lib/server/publish";
import { check, supabase } from "@/lib/server/supabase";

// Keeps the index in step with the registry (ARCHITECTURE §7.4): registrations whose confirm
// never arrived (the author closed the tab), author hides and moderator locks. Publishing indexes
// itself at once; this catches everything else. Runs from a daily Vercel cron (the Hobby plan's
// limit) and, after Explore loads, at most every MIN_INTERVAL_S in the background.

/** rpc.testnet.arc.io answers getLogs for at most 10,000 blocks (measured 2026-10-14). */
const MAX_RANGE = BigInt(process.env.ARC_LOGS_MAX_RANGE || 10_000);
export const MIN_INTERVAL_S = 120;

export type SyncResult =
  | { skipped: "not configured" | "recent" }
  | { from: string; to: string; applied: number; caughtUp: boolean };

export async function syncRegistry({ budgetMs = 20_000, minIntervalS = MIN_INTERVAL_S } = {}): Promise<SyncResult> {
  const db = supabase();
  if (!db || !REGISTRY) return { skipped: "not configured" };
  const key = `registry:${CHAIN.id}:${REGISTRY.address.toLowerCase()}`;

  const last = check(
    await db.rpc("claim_indexer", { p_key: key, p_start: (REGISTRY.deployBlock - BigInt(1)).toString(), p_min_interval_seconds: minIntervalS }),
    "claim_indexer",
  );
  if (last === null || last === undefined) return { skipped: "recent" };

  const started = Date.now();
  const latest = await arcClient.getBlockNumber();
  const first = BigInt(last as number | string) + BigInt(1);
  let from = first;
  let applied = 0;

  while (from <= latest && Date.now() - started < budgetMs) {
    const to = from + MAX_RANGE - BigInt(1) < latest ? from + MAX_RANGE - BigInt(1) : latest;
    const logs = await arcClient.getLogs({ address: REGISTRY.address, fromBlock: from, toBlock: to });
    for (const a of registryActions(logs, REGISTRY.address)) {
      if (a.kind === "registered") {
        // Only registrations prepared on this site have a name and card text; others stay unindexed
        if (await confirmRegistration(a.author, a)) applied++;
      } else if (a.kind === "hidden" || a.kind === "locked") {
        const patch = a.kind === "hidden" ? { author_hidden: a.hidden } : { moderator_locked: a.locked };
        const rows = check(await db.from("guidelines").update(patch).eq("id", a.id.toString()).select("id"), "apply flag") ?? [];
        applied += rows.length;
      } else {
        console.log(`[indexer] version ${a.version} of #${a.id} not indexed yet (no new-version flow)`);
      }
    }
    check(await db.rpc("save_indexer", { p_key: key, p_last_block: to.toString() }), "save_indexer");
    from = to + BigInt(1);
  }

  if (applied > 0) revalidateTag(GUIDELINES_TAG, { expire: 0 });
  return { from: first.toString(), to: (from - BigInt(1)).toString(), applied, caughtUp: from > latest };
}
