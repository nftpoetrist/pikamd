"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getChainId, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { CHAIN, REGISTRY, REVIEWS } from "@/lib/chain";
import { useSignedIn } from "@/lib/collection/client";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import { LIBRARY_KEY } from "@/lib/library/client";
import { REVIEWS_ABI } from "@/lib/reviews-abi";
import { api } from "@/lib/wallet/api";
import { wagmiConfig } from "@/lib/wallet/config";

// Moderation in the browser (/mod). The server checks MODERATOR_ROLE on Arc for every call; this
// only asks, to show the page and the wallet menu link. Locking is the moderator's own Arc
// transaction (setModeratorLock), then the server copies it from the chain.

export const MOD_KEY = ["mod"] as const;

export type QueueItem = {
  id: number;
  slug: string;
  title: string;
  author: string;
  hidden: boolean;
  locked: boolean;
  flagged: boolean;
  pinned: boolean;
  reports: { reason: string; note: string | null; reporter: string; at: string }[];
};
export type ReviewItem = { id: number; slug: string; title: string; author: string; version: number; contentHash: string; flagged: boolean; reviewed: boolean };
export type Queue = { reported: QueueItem[]; flagged: QueueItem[]; locked: QueueItem[]; review: ReviewItem[] };

export function useIsModerator() {
  const { wallet, signed } = useSignedIn();
  return useQuery({
    queryKey: [...MOD_KEY, "me", wallet?.toLowerCase()],
    queryFn: async () => (await api<{ moderator: boolean }>("/api/mod/me")).moderator,
    enabled: signed,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useModQueue(enabled: boolean) {
  const { wallet } = useSignedIn();
  return useQuery({
    queryKey: [...MOD_KEY, "queue", wallet?.toLowerCase()],
    queryFn: () => api<Queue>("/api/mod/queue"),
    enabled,
    staleTime: 10_000,
    retry: false,
  });
}

export function useModActions() {
  const client = useQueryClient();
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: [...MOD_KEY, "queue"] }), [client]);

  /** Locks or unlocks on Arc from the moderator's wallet, then syncs the index. */
  const setLock = useCallback(
    async (id: number, locked: boolean) => {
      if (!REGISTRY) throw new Error("Moderation isn't available on this network yet");
      if (getChainId(wagmiConfig) !== CHAIN.id) await switchChain(wagmiConfig, { chainId: CHAIN.id });
      const hash = await writeContract(wagmiConfig, {
        address: REGISTRY.address,
        abi: REGISTRY_ABI,
        functionName: "setModeratorLock",
        args: [BigInt(id), locked],
        chainId: CHAIN.id,
      });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: CHAIN.id, timeout: 60_000 });
      if (receipt.status !== "success") throw new Error("The transaction failed on Arc, so nothing changed");
      await api("/api/mod/lock", { method: "POST", body: { txHash: hash } });
      await refresh();
    },
    [refresh],
  );

  /**
   * Approves the exact version the moderator read (GuidelineReviews.approve), or takes the approval
   * back, from the moderator's own wallet; then the server copies it from Arc.
   */
  const setReview = useCallback(
    async (id: number, version: number, approve: boolean) => {
      if (!REVIEWS) throw new Error("Reviews aren't available on this network yet");
      if (getChainId(wagmiConfig) !== CHAIN.id) await switchChain(wagmiConfig, { chainId: CHAIN.id });
      const hash = approve
        ? await writeContract(wagmiConfig, { address: REVIEWS.address, abi: REVIEWS_ABI, functionName: "approve", args: [BigInt(id), version], chainId: CHAIN.id })
        : await writeContract(wagmiConfig, { address: REVIEWS.address, abi: REVIEWS_ABI, functionName: "revoke", args: [BigInt(id)], chainId: CHAIN.id });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: CHAIN.id, timeout: 60_000 });
      if (receipt.status !== "success") throw new Error("The transaction failed on Arc, so nothing changed");
      await api("/api/mod/review", { method: "POST", body: { txHash: hash } });
      await Promise.all([refresh(), client.invalidateQueries({ queryKey: LIBRARY_KEY })]);
    },
    [client, refresh],
  );

  const act = useCallback(
    async (id: number, action: "dismiss" | "approve" | "unpin") => {
      const result = await api<Record<string, number | boolean>>("/api/mod/action", { method: "POST", body: { guidelineId: id, action } });
      await refresh();
      return result;
    },
    [refresh],
  );

  return { setLock, setReview, act };
}
