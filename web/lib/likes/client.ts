"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/wallet/api";

// Likes in the browser (K22). The server is the only judge (session wallet, one like per wallet
// per guideline, PikaGold only for the first like); the UI updates optimistically and takes the
// server's numbers after.

export type LikeSummary = { counts: Record<string, number>; mine: string[] };
export type LikeResult = { liked: true; created: boolean; restored: boolean; count: number } | { liked: false; removed: boolean; count: number };
export const LIKES_KEY = ["likes"] as const;

export function useLikeSummary() {
  return useQuery({
    queryKey: LIKES_KEY,
    queryFn: () => api<LikeSummary>("/api/likes"),
    staleTime: 30_000,
    retry: false,
  });
}

/** Likes (`like: true`) or takes a like back (`like: false`). */
export function useLike() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, like }: { slug: string; like: boolean }) =>
      api<LikeResult>(`/api/likes/${encodeURIComponent(slug)}`, { method: like ? "PUT" : "DELETE" }),
    onMutate: async ({ slug, like }) => {
      await client.cancelQueries({ queryKey: LIKES_KEY });
      const previous = client.getQueryData<LikeSummary>(LIKES_KEY);
      if (previous && previous.mine.includes(slug) !== like) {
        const count = previous.counts[slug] ?? 0;
        client.setQueryData<LikeSummary>(LIKES_KEY, {
          counts: { ...previous.counts, [slug]: like ? count + 1 : Math.max(0, count - 1) },
          mine: like ? [...previous.mine, slug] : previous.mine.filter((s) => s !== slug),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(LIKES_KEY, context.previous);
    },
    onSettled: () => {
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
