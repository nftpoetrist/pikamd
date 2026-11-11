"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, publicRead } from "@/lib/wallet/api";
import { SESSION_KEY, useSessionWallet } from "@/lib/wallet/session";

// Likes in the browser (K22). The server is the only judge (session wallet, one like per wallet
// per guideline, PikaGold only for the first like); the UI updates optimistically and takes the
// server's numbers after.

export type LikeSummary = { counts: Record<string, number>; mine: string[] };
export type LikeResult = { liked: true; created: boolean; restored: boolean; count: number } | { liked: false; removed: boolean; count: number };

// Two answers, two queries (both under "likes", so one invalidation reaches both):
// - the counts everyone sees: public, kept by the CDN for a few seconds (/api/likes)
// - what the signed-in wallet liked: private, asked only with a session (/api/me/likes)
export const LIKES_KEY = ["likes"] as const;
const COUNTS_KEY = ["likes", "counts"] as const;
const mineKey = (wallet: string | null | undefined) => ["likes", "mine", wallet?.toLowerCase() ?? null] as const;

type Counts = { counts: Record<string, number> };
type Mine = { mine: string[] };

export function useLikeSummary(): { data: LikeSummary | undefined; error: Error | null } {
  const session = useSessionWallet();
  const counts = useQuery({
    queryKey: COUNTS_KEY,
    queryFn: () => api<Counts>(publicRead("/api/likes")),
    staleTime: 30_000,
    retry: false,
  });
  const mine = useQuery({
    queryKey: mineKey(session.data),
    queryFn: () => api<Mine>("/api/me/likes"),
    enabled: !!session.data, // a visitor without a session likes nothing: no call at all
    staleTime: 30_000,
    retry: false,
  });
  return {
    data: counts.data ? { counts: counts.data.counts, mine: (session.data && mine.data?.mine) || [] } : undefined,
    error: counts.error,
  };
}

/** Likes (`like: true`) or takes a like back (`like: false`). */
export function useLike() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, like }: { slug: string; like: boolean }) =>
      api<LikeResult>(`/api/likes/${encodeURIComponent(slug)}`, { method: like ? "PUT" : "DELETE" }),
    onMutate: async ({ slug, like }) => {
      await client.cancelQueries({ queryKey: LIKES_KEY });
      const key = mineKey(client.getQueryData<string | null>(SESSION_KEY));
      const counts = client.getQueryData<Counts>(COUNTS_KEY);
      const mine = client.getQueryData<Mine>(key);
      // Right after signing in the wallet's own list may not have arrived yet: nothing liked, as far as the screen knows
      const liked = mine?.mine ?? [];
      if (counts && liked.includes(slug) !== like) {
        const count = counts.counts[slug] ?? 0;
        client.setQueryData<Counts>(COUNTS_KEY, { counts: { ...counts.counts, [slug]: like ? count + 1 : Math.max(0, count - 1) } });
        client.setQueryData<Mine>(key, { mine: like ? [...liked, slug] : liked.filter((s) => s !== slug) });
      }
      return { key, counts, mine };
    },
    onError: (_error, _vars, context) => {
      if (context?.counts) client.setQueryData(COUNTS_KEY, context.counts);
      if (context?.mine) client.setQueryData(context.key, context.mine);
    },
    onSettled: () => {
      // This browser just wrote, so the counts come back fresh, not from the CDN's copy (publicRead)
      void client.invalidateQueries({ queryKey: LIKES_KEY });
      void client.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/**
 * Public profile numbers for a wallet (no sign-in needed): PikaGold, guideline count and the tips
 * it received (USDC units as a decimal string, exact; K21).
 */
export function useProfile(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["profile", address],
    queryFn: () =>
      api<{ address: string; pikagold: number; guidelines: number; tipsReceived: string; tipsCount: number }>(`/api/profile/${address}`),
    enabled: !!address,
    staleTime: 30_000,
    retry: false,
  });
}
