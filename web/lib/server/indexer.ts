import "server-only";
import { revalidateTag } from "next/cache";
import type { Log } from "viem";
import { CHAIN, REGISTRY, REVIEWS, TIPS } from "@/lib/chain";
import { GUIDELINES_TAG } from "@/lib/data/guidelines";
import { registryActions } from "@/lib/registry-events";
import { moderatorRoleEvents, reviewEvents } from "@/lib/reviews/events";
import { tipEvents } from "@/lib/tips/events";
import { arcClient } from "@/lib/server/auth";
import { confirmRegistration } from "@/lib/server/publish";
import { check, supabase } from "@/lib/server/supabase";
import { recordModeratorRoles, recordReviews } from "@/lib/server/reviews";
import { recordTips } from "@/lib/server/tips";

// Keeps the index in step with the chain (ARCHITECTURE §7.4). Registry: registrations whose
// confirm never arrived (the author closed the tab), author hides and moderator locks. Tips: every
// Tipped event of GuidelineTips (K21), in case the tipper's browser never reported it. Publishing,
// hiding and tipping index themselves at once; this catches everything else. Runs from a daily
// Vercel cron (the Hobby plan's limit) and, after Explore loads, at most every MIN_INTERVAL_S in
// the background. Each contract has its own cursor in indexer_state, from its own deploy block.

/** rpc.testnet.arc.io answers getLogs for at most 10,000 blocks (measured 2026-10-14). */
const MAX_RANGE = BigInt(process.env.ARC_LOGS_MAX_RANGE || 10_000);
export const MIN_INTERVAL_S = 120;

export type SyncResult =
  | { skipped: "not configured" | "recent" }
  | { from: string; to: string; applied: number; caughtUp: boolean };

type Source = { name: string; address: `0x${string}`; deployBlock: bigint; apply: (logs: Log[]) => Promise<number> };

/** Reads the contract's logs from where its cursor stopped, in ranges, until caught up or out of time. */
async function sync(source: Source, { budgetMs, minIntervalS }: { budgetMs: number; minIntervalS: number }): Promise<SyncResult> {
  const db = supabase()!;
  const key = `${source.name}:${CHAIN.id}:${source.address.toLowerCase()}`;
  const last = check(
    await db.rpc("claim_indexer", { p_key: key, p_start: (source.deployBlock - BigInt(1)).toString(), p_min_interval_seconds: minIntervalS }),
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
    const logs = await arcClient.getLogs({ address: source.address, fromBlock: from, toBlock: to });
    applied += await source.apply(logs);
    check(await db.rpc("save_indexer", { p_key: key, p_last_block: to.toString() }), "save_indexer");
    from = to + BigInt(1);
  }
  return { from: first.toString(), to: (from - BigInt(1)).toString(), applied, caughtUp: from > latest };
}

export async function syncRegistry({ budgetMs = 20_000, minIntervalS = MIN_INTERVAL_S } = {}): Promise<SyncResult> {
  const db = supabase();
  if (!db || !REGISTRY) return { skipped: "not configured" };
  const registry = REGISTRY;

  const result = await sync(
    {
      name: "registry",
      address: registry.address,
      deployBlock: registry.deployBlock,
      async apply(logs) {
        let applied = 0;
        for (const a of registryActions(logs, registry.address)) {
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
        // A moderator who loses MODERATOR_ROLE loses their reviews (the Reviewed badge)
        applied += await recordModeratorRoles(moderatorRoleEvents(logs, registry.address));
        return applied;
      },
    },
    { budgetMs, minIntervalS },
  );

  if ("applied" in result && result.applied > 0) revalidateTag(GUIDELINES_TAG, { expire: 0 });
  return result;
}

export async function syncReviews({ budgetMs = 20_000, minIntervalS = MIN_INTERVAL_S } = {}): Promise<SyncResult> {
  if (!supabase() || !REVIEWS) return { skipped: "not configured" };
  const reviews = REVIEWS;
  const result = await sync(
    { name: "reviews", address: reviews.address, deployBlock: reviews.deployBlock, apply: (logs) => recordReviews(reviewEvents(logs, reviews.address)) },
    { budgetMs, minIntervalS },
  );
  if ("applied" in result && result.applied > 0) revalidateTag(GUIDELINES_TAG, { expire: 0 }); // the badge is on the cached lists
  return result;
}

export async function syncTips({ budgetMs = 20_000, minIntervalS = MIN_INTERVAL_S } = {}): Promise<SyncResult> {
  if (!supabase() || !TIPS) return { skipped: "not configured" };
  const tips = TIPS;
  // Tips change no cached page (the profile is read fresh), so nothing to revalidate
  return sync({ name: "tips", address: tips.address, deployBlock: tips.deployBlock, apply: (logs) => recordTips(tipEvents(logs, tips.address)) }, { budgetMs, minIntervalS });
}
