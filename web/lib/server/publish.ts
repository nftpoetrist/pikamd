import "server-only";
import type { PublishInput } from "@/lib/publish/validate";
import type { Registration } from "@/lib/publish/receipt";
import { check, supabase } from "@/lib/server/supabase";

// Database side of publishing (web/supabase/migrations/20261014090000_publish_flow.sql).
// Publishing needs the real database: the local dev store has no publish tables.

/** How long a prepared upload waits for the author's wallet to register it. */
export const PENDING_TTL_S = 24 * 60 * 60;

export const publishDatabase = () => supabase();

/** True when no listed or hidden guideline and no other wallet's reservation uses the slug. */
export async function slugIsFree(slug: string, wallet: string): Promise<boolean> {
  const db = supabase()!;
  const [taken, reserved] = await Promise.all([
    db.from("guidelines").select("id").eq("slug", slug).limit(1),
    db.from("pending_uploads").select("id").eq("slug", slug).neq("wallet_address", wallet.toLowerCase()).gt("expires_at", new Date().toISOString()).limit(1),
  ]);
  return (check(taken, "slug check") ?? []).length === 0 && (check(reserved, "slug check") ?? []).length === 0;
}

/** Reserves the slug and stores the scanned, pinned file. False if the slug was taken meanwhile. */
export async function savePending(wallet: string, input: PublishInput, pin: { cid: string; id: string }, contentHash: string): Promise<boolean> {
  const result = check(
    await supabase()!.rpc("prepare_upload", {
      p_wallet: wallet.toLowerCase(),
      p_slug: input.slug,
      p_cid: pin.cid,
      p_pinata_id: pin.id,
      p_content_hash: contentHash,
      p_content: input.content,
      p_meta: input.meta,
      p_scan_status: input.scanStatus,
      p_scan_report: input.scanReport,
      p_ttl_seconds: PENDING_TTL_S,
    }),
    "prepare_upload",
  );
  return result === "ok";
}

/** Indexes a verified registration. The slug, or null when the wallet has no matching upload. */
export async function confirmRegistration(wallet: string, r: Registration): Promise<string | null> {
  const res = await supabase()!.rpc("confirm_guideline", {
    p_wallet: wallet.toLowerCase(),
    p_id: r.id.toString(),
    p_cid: r.cid,
    p_content_hash: r.contentHash.toLowerCase(),
    p_parent_id: r.parentId.toString(),
    p_license: r.license,
    p_tx_hash: r.txHash.toLowerCase(),
    p_block_number: r.blockNumber.toString(),
    p_log_index: r.logIndex,
  });
  if (res.error?.code === "P0002") return null;
  return check(res, "confirm_guideline") as string;
}
