import "server-only";
import type { AppStore } from "@/lib/server/store";

// Read models for likes and PikaGold (K22), built from the store's like rows only.

/** Active likes per listed guideline, as a plain object (public: the same for every visitor). */
export const likeCounts = async (store: AppStore) => Object.fromEntries(await store.likeCounts());

export const profileFor = (store: AppStore, wallet: string) => store.profile(wallet);
