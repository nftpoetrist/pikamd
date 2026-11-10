"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getChainId, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { suggestedFees } from "@/lib/wallet/fees";
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
export type Queue = { reported: QueueItem[]; flagged: QueueItem[]; locked: QueueItem[]; hidden: QueueItem[]; review: ReviewItem[] };

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
      const call = {
        address: REGISTRY.address,
        abi: REGISTRY_ABI,
        functionName: "setModeratorLock",
        args: [BigInt(id), locked],
        chainId: CHAIN.id,
      } as const;
      // A free dry run first (the connected wallet as sender): a lock Arc would refuse isn't sent
      await simulateContract(wagmiConfig, call);
      const hash = await writeContract(wagmiConfig, { ...call, ...(await suggestedFees()) });
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
      // The registry's errors too: approve reads the guideline from it
      const abi = [...REVIEWS_ABI, ...REGISTRY_ABI.filter((item) => item.type === "error")] as const;
      const base = { address: REVIEWS.address, abi, chainId: CHAIN.id } as const;
      let hash: `0x${string}`;
      if (approve) {
        const call = { ...base, functionName: "approve", args: [BigInt(id), version] } as const;
        await simulateContract(wagmiConfig, call); // a free dry run: a refused approval isn't sent
        hash = await writeContract(wagmiConfig, { ...call, ...(await suggestedFees()) });
      } else {
        const call = { ...base, functionName: "revoke", args: [BigInt(id)] } as const;
        await simulateContract(wagmiConfig, call);
        hash = await writeContract(wagmiConfig, { ...call, ...(await suggestedFees()) });
      }
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: CHAIN.id, timeout: 60_000 });
      if (receipt.status !== "success") throw new Error("The transaction failed on Arc, so nothing changed");
      await api("/api/mod/review", { method: "POST", body: { txHash: hash } });
      await Promise.all([refresh(), client.invalidateQueries({ queryKey: LIBRARY_KEY })]);
    },
    [client, refresh],
  );

  const act = useCallback(
    async (id: number, action: "dismiss" | "approve" | "unpin" | "purge") => {
      const result = await api<Record<string, number | boolean>>("/api/mod/action", { method: "POST", body: { guidelineId: id, action } });
      await refresh();
      if (action === "purge") await client.invalidateQueries({ queryKey: LIBRARY_KEY });
      return result;
    },
    [client, refresh],
  );

  return { setLock, setReview, act };
}
