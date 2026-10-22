// Supabase rows → domain types. Pure, so it runs in tests. The view is `listed_guidelines`
// (web/supabase/migrations): one row per listed guideline with its latest version's content.
import { getAddress, isAddress } from "viem";
import type { Guideline, GuidelineCard, GuidelineKind, License, OwnedGuideline } from "@/lib/types";

/** The contract's license list (GuidelineRegistry.licenses), by id. Append only. */
export const LICENSES: readonly License[] = ["CC-BY-4.0"];

const KINDS: readonly GuidelineKind[] = ["rules", "skill", "prompt", "agent", "guide"];

export type GuidelineRow = {
  id: number | string;
  slug: string;
  author_address: string;
  title: string;
  description: string;
  kind: string;
  tags: string[] | null;
  license: number;
  latest_version: number;
  uses_count: number;
  stars_count: number;
  content: string;
  scan_status?: string;
  cid?: string | null;
  content_hash?: string | null;
  tx_hash?: string | null;
};

/** A row without the file: what card lists read. */
export type GuidelineCardRow = Omit<GuidelineRow, "content">;

/** The columns `rowToCard` reads, for .select(): everything but the file. */
export const CARD_COLUMNS =
  "id, slug, author_address, title, description, kind, tags, license, latest_version, uses_count, stars_count, scan_status, cid, content_hash, tx_hash";

/** The columns `rowToGuideline` reads, for .select(). */
export const GUIDELINE_COLUMNS = `${CARD_COLUMNS}, content`;

const HASH_RE = /^0x[0-9a-f]{64}$/;

/** A guideline, or null when the row doesn't fit (the caller logs and skips it). */
export function rowToGuideline(row: GuidelineRow): Guideline | null {
  const id = Number(row.id);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  if (!isAddress(row.author_address, { strict: false })) return null;
  const kind = KINDS.find((k) => k === row.kind);
  const license = LICENSES[row.license];
  if (!kind || !license) return null;
  return {
    id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    kind,
    tags: Array.isArray(row.tags) ? row.tags : [],
    author: { address: getAddress(row.author_address) },
    license,
    latestVersion: Number(row.latest_version),
    stars: Number(row.stars_count) || 0,
    uses: Number(row.uses_count) || 0,
    content: row.content,
    flagged: row.scan_status === "suspicious",
    ...(typeof row.cid === "string" && row.cid && HASH_RE.test(row.content_hash ?? "") && HASH_RE.test(row.tx_hash ?? "")
      ? { record: { txHash: row.tx_hash as `0x${string}`, cid: row.cid, contentHash: row.content_hash as `0x${string}` } }
      : {}),
  };
}

/** What agents may receive over MCP: never guidelines with unchecked flagged lines (ARCHITECTURE §8, §9.1). */
export const forAgents = <G extends { flagged?: boolean }>(guidelines: G[]): G[] => guidelines.filter((g) => !g.flagged);

/** A card (a guideline without its file), or null when the row doesn't fit. */
export function rowToCard(row: GuidelineCardRow): GuidelineCard | null {
  const g = rowToGuideline({ ...row, content: "" });
  if (!g) return null;
  const { content, ...card } = g;
  void content;
  return card;
}

/** A row of author_guidelines(wallet): the card fields plus both flags, no file content. */
export type OwnedGuidelineRow = GuidelineCardRow & { author_hidden: unknown; moderator_locked: unknown };

/** The author's own guideline, or null when the row doesn't fit (flags must be real booleans: never guess "listed"). */
export function rowToOwned(row: OwnedGuidelineRow): OwnedGuideline | null {
  if (typeof row.author_hidden !== "boolean" || typeof row.moderator_locked !== "boolean") return null;
  const card = rowToCard(row);
  return card && { ...card, hidden: row.author_hidden, locked: row.moderator_locked };
}
