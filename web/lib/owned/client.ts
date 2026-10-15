"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useConnection } from "wagmi";
import { getChainId, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { CHAIN, REGISTRY } from "@/lib/chain";
import { useHydrated } from "@/lib/hydrated";
import { sameWallet } from "@/lib/likes/rules";
import { messageFor } from "@/lib/publish/client";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import type { GuidelineCard, OwnedGuideline } from "@/lib/types";
import { api } from "@/lib/wallet/api";
import { wagmiConfig } from "@/lib/wallet/config";
import { openWalletModal } from "@/lib/wallet/modal";
import { useSessionWallet, useSignIn } from "@/lib/wallet/session";

// My Collection → Shared by me. Connecting the wallet is enough to see its listed guidelines
// (public anyway, filtered from the page's list); hidden ones and Hide / Show again come after the
// one free sign-in signature. Hiding is the author's own setHidden transaction on Arc
// (GuidelineRegistry): off Explore, search and MCP, and shown again the same way. Nothing is
// deleted: the Arc record and the IPFS file stay.

export const OWNED_KEY = ["owned"] as const;

export type SharedList =
  | { mode: "loading" }
  | { mode: "disconnected" }
  | { mode: "public" | "signed"; wallet: `0x${string}`; guidelines: OwnedGuideline[]; signedIn: boolean; error: string | null };

/** The connected wallet's guidelines: from the server once signed in, else from the public list. */
export function useSharedList(listed: GuidelineCard[]): SharedList {
  // The server can't see the wallet: until hydration ends, render exactly what it rendered
  const hydrated = useHydrated();
  const { address, status } = useConnection();
  const session = useSessionWallet();
  const signed = status === "connected" && !!address && !!session.data && sameWallet(session.data, address);
  const owned = useQuery({
    queryKey: [...OWNED_KEY, address?.toLowerCase()],
    queryFn: async () => (await api<{ guidelines: OwnedGuideline[] }>("/api/me/guidelines")).guidelines,
    enabled: signed,
    staleTime: 30_000,
    retry: false,
  });

  if (!hydrated || status === "connecting" || status === "reconnecting") return { mode: "loading" };
  if (status !== "connected" || !address) return { mode: "disconnected" };
  if (session.isPending) return { mode: "loading" };
  if (signed && owned.data) return { mode: "signed", wallet: address, guidelines: owned.data, signedIn: true, error: null };
  const mine = listed.filter((g) => sameWallet(g.author.address, address)).map((g) => ({ ...g, hidden: false, locked: false }));
  const error = signed && owned.error ? `Couldn't load your hidden guidelines: ${messageFor(owned.error)}` : null;
  return { mode: "public", wallet: address, guidelines: mine, signedIn: signed, error };
}

export const VISIBILITY_PHASES = ["Signing in…", "Check your wallet…", "Writing to Arc…", "Updating PikaMd…"] as const;

/** Hide / Show again for one guideline. A sent transaction is kept, so a retry only syncs it. */
export function useVisibility() {
  const { address, status } = useConnection();
  const session = useSessionWallet();
  const signIn = useSignIn();
  const client = useQueryClient();
  const router = useRouter();
  const [phase, setPhase] = useState(-1); // -1 idle, else an index into VISIBILITY_PHASES
  const [error, setError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<`0x${string}` | null>(null);

  const sync = useCallback(
    async (txHash: `0x${string}`) => {
      setPhase(3);
      await api("/api/guidelines/visibility", { method: "POST", body: { txHash } });
      setPendingTx(null);
      await client.invalidateQueries({ queryKey: OWNED_KEY });
      router.refresh(); // the page's listed guidelines (Saved tab, card props) follow
    },
    [client, router],
  );

  const run = useCallback(
    async (id: number, hidden: boolean) => {
      setError(null);
      if (status !== "connected" || !address) {
        openWalletModal();
        setError("Connect your wallet first");
        return;
      }
      if (!REGISTRY) {
        setError("Hiding guidelines isn't available on this network yet");
        return;
      }
      try {
        setPhase(0);
        if (!session.data || !sameWallet(session.data, address)) await signIn(address);

        if (pendingTx) {
          await sync(pendingTx);
        } else {
          setPhase(1);
          if (getChainId(wagmiConfig) !== CHAIN.id) await switchChain(wagmiConfig, { chainId: CHAIN.id });
          const txHash = await writeContract(wagmiConfig, {
            address: REGISTRY.address,
            abi: REGISTRY_ABI,
            functionName: "setHidden",
            args: [BigInt(id), hidden],
            chainId: CHAIN.id,
          });
          setPendingTx(txHash);

          setPhase(2);
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId: CHAIN.id });
          if (receipt.status !== "success") {
            setPendingTx(null);
            throw new Error("The transaction failed on Arc, so nothing changed. Try again");
          }
          await sync(txHash);
        }
        setPhase(-1);
      } catch (e) {
        const known = e instanceof Error && e.message.startsWith("The transaction failed on Arc");
        setError(known ? (e as Error).message : messageFor(e));
        setPhase(-1);
      }
    },
    [address, status, session.data, signIn, pendingTx, sync],
  );

  const clearError = useCallback(() => setError(null), []);

  return { phase, busy: phase >= 0, error, pendingTx, run, clearError };
}
