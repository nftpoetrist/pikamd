import "server-only";
import { listGuidelines } from "@/lib/data/guidelines";
import { pikagoldFor } from "@/lib/likes/rules";
import type { AppStore } from "@/lib/server/store";

// Read models for likes and PikaGold (K22), built from the store's like rows only.

export async function likeSummary(store: AppStore, wallet: string | null) {
  const [counts, mine] = await Promise.all([store.likeCounts(), wallet ? store.likedSlugs(wallet) : []]);
  return { counts: Object.fromEntries(counts), mine };
}

export async function profileFor(store: AppStore, wallet: string) {
  const [guidelines, counts] = await Promise.all([listGuidelines(), store.likeCounts()]);
  return {
    pikagold: pikagoldFor(wallet, guidelines, counts),
    guidelines: guidelines.filter((g) => g.author.address.toLowerCase() === wallet.toLowerCase()).length,
  };
}
