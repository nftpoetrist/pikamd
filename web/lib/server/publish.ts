import "server-only";
import type { PublishInput } from "@/lib/publish/validate";
import type { Registration } from "@/lib/publish/receipt";
import { check, supabase } from "@/lib/server/supabase";

// Database side of publishing (web/supabase/migrations/20261014090000_publish_flow.sql).
// Publishing needs the real database: the local dev store has no publish tables.

/** How long a prepared upload waits for the author's wallet to register it. */
export const PENDING_TTL_S = 24 * 60 * 60;

export const publishDatabase = () => supabase();

/** Why a prepare can't go ahead, or "ok" (the database's limits, checked again when saving). */
export type PrepareStatus = "ok" | "slug_taken" | "too_many" | "busy";

const STATUSES: readonly PrepareStatus[] = ["ok", "slug_taken", "too_many", "busy"];
const asStatus = (value: unknown, what: string): PrepareStatus => {
  const status = STATUSES.find((s) => s === value);
  if (!status) throw new Error(`Unexpected ${what} answer`);
  return status;
};

/** Checked before the file is pinned: the name is free and this wallet and the site are under their limits. */
export async function prepareCheck(wallet: string, input: PublishInput, contentHash: string): Promise<PrepareStatus> {
  const result = check(
    await supabase()!.rpc("prepare_check", {
      p_wallet: wallet.toLowerCase(),
      p_slug: input.slug,
      p_content_hash: contentHash,
      p_bytes: Buffer.byteLength(input.content, "utf8"),
    }),
    "prepare_check",
  );
  return asStatus(result, "prepare_check");
}

/** Reserves the slug and stores the scanned, pinned file, unless a limit was reached meanwhile. */
export async function savePending(wallet: string, input: PublishInput, pin: { cid: string; id: string }, contentHash: string): Promise<PrepareStatus> {
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
  return asStatus(result, "prepare_upload");
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
  // A constraint the stored upload can't meet will fail the same way every time: report it and move
  // on, so one bad registration never stalls the indexer. Anything else is retried.
  if (res.error?.code?.startsWith("23")) {
    console.error(`[publish] registration #${r.id} can't be indexed: ${res.error.code} ${res.error.message}`);
    return null;
  }
  return check(res, "confirm_guideline") as string;
}

/**
 * Whether a name is taken, the way prepare_check sees it: by any guideline in the index (hidden and
 * locked ones too, which the public list leaves out) or by another wallet's unfinished upload.
 * Without a session only guidelines count: the wallet's own reservations can't be told apart.
 */
export async function nameTaken(slug: string, wallet: string | null): Promise<boolean> {
  const db = supabase()!;
  const used = check(await db.from("guidelines").select("id").eq("slug", slug).limit(1), "name in guidelines") ?? [];
  if (used.length > 0) return true;
  if (!wallet) return false;
  const reserved =
    check(
      await db.from("pending_uploads").select("id").eq("slug", slug).neq("wallet_address", wallet.toLowerCase()).gt("expires_at", new Date().toISOString()).limit(1),
      "name in pending uploads",
    ) ?? [];
  return reserved.length > 0;
}
