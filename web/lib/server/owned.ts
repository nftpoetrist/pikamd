import "server-only";
import { rowToOwned, type OwnedGuidelineRow } from "@/lib/data/rows";
import type { OwnedGuideline } from "@/lib/types";
import { check, supabase } from "@/lib/server/supabase";

// "Shared by me" on My Collection (web/supabase/migrations/20261015160000_author_guidelines.sql).
// Callers pass the wallet from the signed session only, never from a request body.

/** Every guideline this wallet registered, hidden and locked ones included, newest first. */
export async function ownedGuidelines(wallet: string): Promise<OwnedGuideline[]> {
  const rows = (check(await supabase()!.rpc("author_guidelines", { p_wallet: wallet.toLowerCase() }), "author_guidelines") ?? []) as OwnedGuidelineRow[];
  const out: OwnedGuideline[] = [];
  for (const row of rows) {
    const g = rowToOwned(row);
    if (g) out.push(g);
    else console.error(`[owned] skipped malformed row id=${String(row.id)}`);
  }
  return out;
}

/**
 * Copies the chain's two flags to the index for one of the wallet's own guidelines. Returns the
 * slug, or null when the index has no such guideline by this wallet.
 */
export async function applyFlags(id: bigint, wallet: string, flags: { hidden: boolean; locked: boolean }): Promise<string | null> {
  const rows = (check(
    await supabase()!
      .from("guidelines")
      .update({ author_hidden: flags.hidden, moderator_locked: flags.locked })
      .eq("id", id.toString())
      .eq("author_address", wallet.toLowerCase())
      .select("slug"),
    "apply flags",
  ) ?? []) as { slug: string }[];
  return rows[0]?.slug ?? null;
}
