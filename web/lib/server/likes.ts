import "server-only";
import type { AppStore } from "@/lib/server/store";

// Read models for likes and PikaGold (K22), built from the store's like rows only.

export async function likeSummary(store: AppStore, wallet: string | null) {
  const [counts, mine] = await Promise.all([store.likeCounts(), wallet ? store.likedSlugs(wallet) : []]);
  return { counts: Object.fromEntries(counts), mine };
}

export const profileFor = (store: AppStore, wallet: string) => store.profile(wallet);
