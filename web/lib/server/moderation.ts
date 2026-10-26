import "server-only";
import { getAddress, keccak256, stringToBytes } from "viem";
import { REGISTRY, isModeratorWallet } from "@/lib/chain";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import type { ReportReason } from "@/lib/moderation/reasons";
import { arcClient } from "@/lib/server/auth";
import { unpin } from "@/lib/server/pinata";
import { check, supabase } from "@/lib/server/supabase";

// Reports and moderation (web/supabase/migrations/20261018120000_moderation.sql). Who moderates:
// a wallet on the site's own list (lib/chain.ts, MODERATOR_WALLETS) that also holds MODERATOR_ROLE
// in GuidelineRegistry on Arc right now. Both, always: every /api/mod route goes through here.

const MODERATOR_ROLE = keccak256(stringToBytes("MODERATOR_ROLE"));

export async function isModerator(wallet: string): Promise<boolean> {
  if (!REGISTRY || !isModeratorWallet(wallet)) return false;
  return arcClient.readContract({
    address: REGISTRY.address,
    abi: REGISTRY_ABI,
    functionName: "hasRole",
    args: [MODERATOR_ROLE, wallet as `0x${string}`],
  });
}

/** True: reported. False: this wallet had reported it already. Null: not a listed guideline. */
export async function addReport(wallet: string, slug: string, reason: ReportReason, note: string | null): Promise<boolean | null> {
  const res = await supabase()!.rpc("add_report", { p_wallet: wallet.toLowerCase(), p_slug: slug, p_reason: reason, p_note: note });
  if (res.error?.code === "P0002") return null;
  return check(res, "add_report") === true;
}

export type QueueItem = {
  id: number;
  slug: string;
  title: string;
  author: string;
  hidden: boolean;
  locked: boolean;
  flagged: boolean;
  /** Our Pinata pins of its versions (unpinned once a moderator removed them) */
  pinned: boolean;
  reports: { reason: string; note: string | null; reporter: string; at: string }[];
};

/** A listed guideline for the Reviewed badge (ARCHITECTURE §9.5): approve it, or take it back. */
export type ReviewItem = {
  id: number;
  slug: string;
  title: string;
  author: string;
  version: number;
  contentHash: string;
  flagged: boolean;
  reviewed: boolean;
};

type GuidelineRow = {
  id: number;
  slug: string;
  title: string;
  author_address: string;
  author_hidden: boolean;
  moderator_locked: boolean;
  latest_version: number;
  guideline_versions: { version: number; pinata_id: string | null; scan_status: string }[];
};

const G_FIELDS = "id, slug, title, author_address, author_hidden, moderator_locked, latest_version, guideline_versions(version, pinata_id, scan_status)";

/** Everything waiting for a moderator: open reports, files the scan flagged, locked and hidden guidelines. */
export async function moderationQueue(): Promise<{ reported: QueueItem[]; flagged: QueueItem[]; locked: QueueItem[]; hidden: QueueItem[]; review: ReviewItem[] }> {
  const db = supabase()!;
  const [reports, flagged, locked, hidden, listed] = await Promise.all([
    db.from("reports").select(`reason, note, reporter_address, created_at, guidelines(${G_FIELDS})`).eq("status", "open").order("created_at", { ascending: false }).limit(1000),
    db.from("listed_guidelines").select("id").eq("scan_status", "suspicious").limit(500),
    db.from("guidelines").select(G_FIELDS).eq("moderator_locked", true).order("id", { ascending: false }).limit(500),
    db.from("guidelines").select(G_FIELDS).eq("author_hidden", true).eq("moderator_locked", false).order("id", { ascending: false }).limit(500),
    db.from("listed_guidelines").select("id, slug, title, author_address, latest_version, content_hash, scan_status, reviewed").order("block_number", { ascending: false }).limit(500),
  ]);
  const item = (g: GuidelineRow): QueueItem => {
    const latest = g.guideline_versions.find((v) => v.version === g.latest_version);
    return {
      id: Number(g.id),
      slug: g.slug,
      title: g.title,
      author: getAddress(g.author_address),
      hidden: g.author_hidden,
      locked: g.moderator_locked,
      flagged: latest?.scan_status === "suspicious",
      pinned: g.guideline_versions.some((v) => !!v.pinata_id),
      reports: [],
    };
  };
  const byId = new Map<number, QueueItem>();
  for (const r of (check(reports, "open reports") ?? []) as unknown as { reason: string; note: string | null; reporter_address: string; created_at: string; guidelines: GuidelineRow }[]) {
    const g = byId.get(Number(r.guidelines.id)) ?? item(r.guidelines);
    g.reports.push({ reason: r.reason, note: r.note, reporter: getAddress(r.reporter_address), at: r.created_at });
    byId.set(g.id, g);
  }
  const flaggedIds = ((check(flagged, "flagged") ?? []) as { id: number }[]).map((r) => Number(r.id));
  const flaggedRows = flaggedIds.length
    ? ((check(await db.from("guidelines").select(G_FIELDS).in("id", flaggedIds), "flagged guidelines") ?? []) as unknown as GuidelineRow[])
    : [];
  return {
    reported: [...byId.values()].sort((a, b) => b.reports.length - a.reports.length),
    flagged: flaggedRows.map(item),
    locked: ((check(locked, "locked") ?? []) as unknown as GuidelineRow[]).map(item),
    hidden: ((check(hidden, "hidden") ?? []) as unknown as GuidelineRow[]).map(item),
    review: (
      (check(listed, "listed for review") ?? []) as unknown as {
        id: number; slug: string; title: string; author_address: string; latest_version: number; content_hash: string; scan_status: string; reviewed: boolean | null;
      }[]
    ).map((g) => ({
      id: Number(g.id),
      slug: g.slug,
      title: g.title,
      author: getAddress(g.author_address),
      version: Number(g.latest_version),
      contentHash: g.content_hash,
      flagged: g.scan_status === "suspicious",
      reviewed: g.reviewed === true,
    })),
  };
}

export async function dismissReports(guidelineId: number, moderator: string): Promise<number> {
  return Number(check(await supabase()!.rpc("resolve_reports", { p_guideline_id: guidelineId, p_status: "dismissed", p_moderator: moderator.toLowerCase(), p_tx_hash: null }), "resolve_reports"));
}

export async function approveFlagged(guidelineId: number, moderator: string): Promise<boolean> {
  return check(await supabase()!.rpc("approve_flagged", { p_guideline_id: guidelineId, p_moderator: moderator.toLowerCase() }), "approve_flagged") === true;
}

/**
 * Copies a lock change read from Arc to the index: both flags as the chain has them at that
 * block, the log entry, and (on a lock) the guideline's open reports closed as actioned.
 * False when the index doesn't know the guideline.
 */
export async function applyLock(
  change: { id: bigint; txHash: `0x${string}` },
  flags: { hidden: boolean; locked: boolean },
  moderator: string,
): Promise<boolean> {
  const db = supabase()!;
  const id = change.id.toString();
  const rows = check(await db.from("guidelines").update({ author_hidden: flags.hidden, moderator_locked: flags.locked }).eq("id", id).select("id"), "apply lock") ?? [];
  if (rows.length === 0) return false;
  const tx = change.txHash.toLowerCase();
  const logged = await db.from("moderation_log").select("id").eq("tx_hash", tx).limit(1);
  if ((check(logged, "lock log") ?? []).length === 0) {
    check(await db.from("moderation_log").insert({ guideline_id: id, moderator: moderator.toLowerCase(), action: flags.locked ? "lock" : "unlock", tx_hash: tx }), "log lock");
  }
  if (flags.locked) check(await db.rpc("resolve_reports", { p_guideline_id: id, p_status: "actioned", p_moderator: moderator.toLowerCase(), p_tx_hash: tx }), "resolve_reports");
  return true;
}

/** Unpins a locked guideline's files that nothing else needs (the database decides). How many. */
export async function unpinLocked(guidelineId: number, moderator: string): Promise<number> {
  const db = supabase()!;
  const files = (check(await db.rpc("unpinnable_files", { p_guideline_id: guidelineId }), "unpinnable_files") ?? []) as { version: number; pinata_id: string }[];
  let done = 0;
  for (const f of files) {
    if (!(await unpin(f.pinata_id))) continue;
    check(await db.rpc("mark_unpinned", { p_guideline_id: guidelineId, p_version: f.version, p_moderator: moderator.toLowerCase() }), "mark_unpinned");
    done++;
  }
  return done;
}

export type PurgeResult = { purged: true; unpinned: number; kept: number } | { purged: false; reason: "listed" | "unknown" | "unpin" };

/**
 * Deletes a guideline from PikaMd for good (migration 20261026090000_purge.sql). Only one that is
 * off the site on Arc right now (hidden by its author or locked), read from the chain, never the
 * index. Files first: the ones nothing else uses are unpinned, and if Pinata fails nothing is
 * deleted, so the moderator can try again. Then the rows, in one transaction.
 */
export async function purgeGuideline(guidelineId: number): Promise<PurgeResult> {
  if (!REGISTRY) return { purged: false, reason: "unknown" };
  const db = supabase()!;
  let onChain;
  try {
    onChain = await arcClient.readContract({ address: REGISTRY.address, abi: REGISTRY_ABI, functionName: "getGuideline", args: [BigInt(guidelineId)] });
  } catch {
    return { purged: false, reason: "unknown" }; // the registry reverts for an id it never issued
  }
  if (!onChain.authorHidden && !onChain.moderatorLocked) return { purged: false, reason: "listed" };

  const files = ((check(await db.rpc("purge_files", { p_guideline_id: guidelineId }), "purge_files") ?? []) as { pinata_id: string }[]).map((f) => f.pinata_id);
  const all = (check(await db.from("guideline_versions").select("pinata_id").eq("guideline_id", guidelineId), "guideline files") ?? []) as { pinata_id: string | null }[];
  for (const id of files) if (!(await unpin(id))) return { purged: false, reason: "unpin" };

  const res = await db.rpc("purge_guideline", { p_guideline_id: guidelineId, p_hidden: onChain.authorHidden, p_locked: onChain.moderatorLocked });
  if (check(res, "purge_guideline") !== true) return { purged: false, reason: "unknown" };
  return { purged: true, unpinned: files.length, kept: new Set(all.map((v) => v.pinata_id).filter((v) => v && !files.includes(v))).size };
}
