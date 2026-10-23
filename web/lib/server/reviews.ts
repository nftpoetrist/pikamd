import "server-only";
import type { ReviewEvent, RoleEvent } from "@/lib/reviews/events";
import { check, supabase } from "@/lib/server/supabase";

// The index's copy of GuidelineReviews' events and the registry's MODERATOR_ROLE changes
// (web/supabase/migrations/20261023120000_reviews.sql). Both writers, POST /api/mod/review and
// the indexer, pass events read from Arc only. The database keeps the newest event per guideline
// (per wallet for roles), so replays and late deliveries change nothing.

/** Stores the events. Returns how many changed the index. */
export async function recordReviews(events: ReviewEvent[]): Promise<number> {
  const db = supabase();
  if (!db) throw new Error("Reviews aren't recorded without a database");
  let changed = 0;
  for (const e of events) {
    const ok = check(
      await db.rpc("apply_review", {
        p_guideline_id: e.guidelineId.toString(),
        p_reviewed: e.reviewed,
        p_version: e.version,
        p_content_hash: e.contentHash,
        p_moderator: e.moderator,
        p_tx_hash: e.txHash,
        p_block_number: e.blockNumber.toString(),
        p_log_index: e.logIndex,
      }),
      "apply_review",
    );
    if (ok) changed++;
  }
  return changed;
}

/** Stores MODERATOR_ROLE grants and revokes. Returns how many changed the index. */
export async function recordModeratorRoles(events: RoleEvent[]): Promise<number> {
  const db = supabase();
  if (!db) throw new Error("Roles aren't recorded without a database");
  let changed = 0;
  for (const e of events) {
    const ok = check(
      await db.rpc("apply_moderator_role", { p_wallet: e.account, p_has_role: e.hasRole, p_block_number: e.blockNumber.toString(), p_log_index: e.logIndex }),
      "apply_moderator_role",
    );
    if (ok) changed++;
  }
  return changed;
}

/** Writes this moderator's approvals and revokes to moderation_log, once per transaction. */
export async function logReviews(events: ReviewEvent[], moderator: `0x${string}`): Promise<void> {
  const db = supabase();
  if (!db) return;
  for (const e of events) {
    const tx = e.txHash.toLowerCase();
    const id = e.guidelineId.toString();
    const seen = check(await db.from("moderation_log").select("id").eq("tx_hash", tx).eq("guideline_id", id).limit(1), "find review log") ?? [];
    if (seen.length > 0) continue;
    const res = await db.from("moderation_log").insert({
      guideline_id: id,
      moderator: moderator.toLowerCase(),
      action: e.reviewed ? "review" : "unreview",
      tx_hash: tx,
      detail: `version ${e.version}`,
    });
    // A guideline PikaMd never indexed has no row to point to: the review is on Arc and in reviews
    if (res.error?.code === "23503") continue;
    check(res, "log review");
  }
}
