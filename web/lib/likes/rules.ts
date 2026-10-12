// Like and PikaGold rules (ARCHITECTURE K22). Pure: the store and routes only call these.
// - Only a signed-in wallet can like; the wallet comes from the session, never from the request.
// - One like per wallet per guideline, permanent (there is no unlike).
// - Authors may like their own guidelines, and that like counts like any other.
// - PikaGold is not stored: an author's PikaGold is the number of likes on their guidelines.
import type { Guideline } from "@/lib/types";

export type LikeDecision =
  | { ok: true }
  | { ok: false; status: 401 | 404; error: string };

export function decideLike(wallet: string | null, slug: string, knownSlugs: ReadonlySet<string>): LikeDecision {
  if (!wallet) return { ok: false, status: 401, error: "Sign in with your wallet to like guidelines" };
  if (!knownSlugs.has(slug)) return { ok: false, status: 404, error: "Guideline not found" };
  return { ok: true };
}

/** Wallet addresses compare case-insensitively (checksum casing is presentation only). */
export const sameWallet = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 1 PikaGold per like on the author's guidelines. */
export function pikagoldFor(
  wallet: string,
  guidelines: readonly Pick<Guideline, "slug" | "author">[],
  likeCounts: ReadonlyMap<string, number>,
): number {
  let total = 0;
  for (const g of guidelines) {
    if (sameWallet(g.author.address, wallet)) total += likeCounts.get(g.slug) ?? 0;
  }
  return total;
}
