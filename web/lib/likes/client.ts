"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/wallet/api";

// Likes in the browser (K22). The server is the only judge (session wallet, one like per wallet
// per guideline, permanent); the UI updates optimistically and takes the server's numbers after.

export type LikeSummary = { counts: Record<string, number>; mine: string[] };
export const LIKES_KEY = ["likes"] as const;

export function useLikeSummary() {
  return useQuery({
    queryKey: LIKES_KEY,
    queryFn: () => api<LikeSummary>("/api/likes"),
    staleTime: 30_000,
    retry: false,
  });
}

export function useLike() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api<{ liked: true; created: boolean; count: number }>(`/api/likes/${encodeURIComponent(slug)}`, { method: "PUT" }),
    onMutate: async (slug) => {
      await client.cancelQueries({ queryKey: LIKES_KEY });
      const previous = client.getQueryData<LikeSummary>(LIKES_KEY);
      if (previous && !previous.mine.includes(slug)) {
        client.setQueryData<LikeSummary>(LIKES_KEY, {
          counts: { ...previous.counts, [slug]: (previous.counts[slug] ?? 0) + 1 },
          mine: [...previous.mine, slug],
        });
      }
      return { previous };
    },
    onError: (_error, _slug, context) => {
      if (context?.previous) client.setQueryData(LIKES_KEY, context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: LIKES_KEY });
      void client.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Public PikaGold and guideline count for a wallet (no sign-in needed). */
export function useProfile(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["profile", address],
    queryFn: () => api<{ address: string; pikagold: number; guidelines: number }>(`/api/profile/${address}`),
    enabled: !!address,
    staleTime: 30_000,
    retry: false,
  });
}
