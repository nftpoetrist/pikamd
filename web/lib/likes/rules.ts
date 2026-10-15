// Like and PikaGold rules (ARCHITECTURE K22). Pure: the store and routes only call these.
// - Only a signed-in wallet can like; the wallet comes from the session, never from the request.
// - One like per wallet per guideline. A like can be taken back and given again.
// - A wallet's first like on a guideline earns the author 1 PikaGold. Taking the like back keeps
//   that PikaGold; liking again earns none (the store keeps one row per wallet and guideline).
// - Authors may like their own guidelines, and that like counts like any other.
// - PikaGold is not stored: an author's PikaGold is the number of first likes on their guidelines.
import type { Guideline } from "@/lib/types";

export type LikeDecision =
  | { ok: true }
  | { ok: false; status: 401 | 404; error: string };

export function decideLike(wallet: string | null, slug: string, knownSlugs: Pick<ReadonlySet<string>, "has">): LikeDecision {
  if (!wallet) return { ok: false, status: 401, error: "Sign in with your wallet to like guidelines" };
  if (!knownSlugs.has(slug)) return { ok: false, status: 404, error: "Guideline not found" };
  return { ok: true };
}

/** Wallet addresses compare case-insensitively (checksum casing is presentation only). */
export const sameWallet = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 1 PikaGold per first like on the author's guidelines (`firstLikes`: taken back or not, per slug). */
export function pikagoldFor(
  wallet: string,
  guidelines: readonly Pick<Guideline, "slug" | "author">[],
  firstLikes: ReadonlyMap<string, number>,
): number {
  let total = 0;
  for (const g of guidelines) {
    if (sameWallet(g.author.address, wallet)) total += firstLikes.get(g.slug) ?? 0;
  }
  return total;
}
