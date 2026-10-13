// Supabase rows → domain types. Pure, so it runs in tests. The view is `listed_guidelines`
// (web/supabase/migrations): one row per listed guideline with its latest version's content.
import { getAddress, isAddress } from "viem";
import type { Guideline, GuidelineKind, License } from "@/lib/types";

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
};

/** The columns `rowToGuideline` reads, for .select(). */
export const GUIDELINE_COLUMNS =
  "id, slug, author_address, title, description, kind, tags, license, latest_version, uses_count, stars_count, content";

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
  };
}
