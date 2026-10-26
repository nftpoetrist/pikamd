"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection } from "wagmi";
import { getChainId, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { suggestedFees } from "@/lib/wallet/fees";
import type { Draft } from "@/lib/publish/draft";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import { sameWallet } from "@/lib/likes/rules";
import { ApiError, api, isUserRejection } from "@/lib/wallet/api";
import { wagmiConfig } from "@/lib/wallet/config";
import { openWalletModal } from "@/lib/wallet/modal";
import { useSessionWallet, useSignIn } from "@/lib/wallet/session";

// The real Publish flow in the browser (ARCHITECTURE §7.1): sign in → the server checks and pins
// the file → the author's wallet registers it on Arc → the server reads the receipt and indexes it.
// Once a transaction is sent its hash is kept in the draft, so a retry only confirms it again and
// never registers the same file twice. The author can step back at any moment, even while the
// wallet hasn't answered: the run is dropped (cancel), and a transaction already on its way still
// lands, the indexer finishes it (§7.4).

export const PHASES = [
  "Signing in with your wallet",
  "Checking your file and uploading it to IPFS",
  "Waiting for your wallet",
  "Writing to Arc",
  "Adding it to PikaMd",
] as const;
export const DONE = PHASES.length;

type Prepared = { cid: string; contentHash: `0x${string}`; slug: string; scanStatus: string; registry: `0x${string}`; chainId: number };
export type Published = { slug: string; txHash: `0x${string}`; id: string };

const FAUCET = "https://faucet.circle.com";

/** An error whose message is already written for the user. */
class PublishError extends Error {}

/** A short message for a failed wallet, chain or API step (also used by Hide / Show again). */
export function messageFor(error: unknown): string {
  if (isUserRejection(error)) return "You cancelled in your wallet. Nothing was written to Arc";
  if (error instanceof ApiError || error instanceof PublishError) return error.message;
  const text = String((error as { shortMessage?: string; message?: string })?.shortMessage ?? (error as Error)?.message ?? "");
  if (/insufficient funds/i.test(text)) return `Your wallet needs a little Arc testnet USDC for the network fee. Get some at ${FAUCET}`;
  if (/chain|network/i.test(text)) return "Switch your wallet to the Arc Network and try again";
  return "Something went wrong, try again";
}

export function usePublish(draft: Draft, update: (patch: Partial<Draft>) => void) {
  const { address, status } = useConnection();
  const session = useSessionWallet();
  const signIn = useSignIn();
  const [phase, setPhase] = useState(-1); // -1 idle, 0..4 running, DONE finished
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Published | null>(null);
  // Each start is a run; cancel or reset starts a new one, and a dropped run changes nothing
  const run = useRef(0);

  const confirm = useCallback(
    async (txHash: `0x${string}`, alive: () => boolean) => {
      setPhase(4);
      const done = await api<Published>("/api/guidelines/confirm", { method: "POST", body: { txHash } });
      if (!alive()) return;
      update({ publishTx: undefined });
      setResult(done);
      setPhase(DONE);
    },
    [update],
  );

  const start = useCallback(async () => {
    const id = ++run.current;
    const alive = () => run.current === id;
    setError(null);
    if (status !== "connected" || !address) {
      openWalletModal();
      setError("Connect your wallet to publish");
      return;
    }
    try {
      // Signed in first in every case: a reload or a new browser session has no session cookie
      setPhase(0);
      if (!session.data || !sameWallet(session.data, address)) await signIn(address);
      if (!alive()) return;

      // A transaction from an earlier try: only confirm it again
      if (draft.publishTx) return await confirm(draft.publishTx, alive);

      setPhase(1);
      const prepared = await api<Prepared>("/api/guidelines/prepare", {
        method: "POST",
        body: { content: draft.content, meta: { title: draft.meta.title, description: draft.meta.description, kind: draft.meta.kind, tags: draft.meta.tags } },
      });
      if (!alive()) return;

      setPhase(2);
      if (getChainId(wagmiConfig) !== prepared.chainId) await switchChain(wagmiConfig, { chainId: prepared.chainId });
      const txHash = await writeContract(wagmiConfig, {
        address: prepared.registry,
        abi: REGISTRY_ABI,
        functionName: "register",
        args: [prepared.cid, prepared.contentHash, BigInt(0), 0],
        chainId: prepared.chainId,
        ...(await suggestedFees()),
      });
      if (!alive()) return; // stepped back meanwhile: the file may have changed, don't tie this hash to it
      update({ publishTx: txHash });

      setPhase(3);
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId: prepared.chainId });
      if (!alive()) return;
      if (receipt.status !== "success") {
        update({ publishTx: undefined });
        throw new PublishError("The transaction failed on Arc, so nothing was published. Try again");
      }
      await confirm(txHash, alive);
    } catch (e) {
      if (!alive()) return;
      setError(messageFor(e));
      setPhase(-1);
    }
  }, [address, status, session.data, signIn, draft, update, confirm]);

  /** Drops the running try (and any error): the author stepped back or left. */
  const reset = useCallback(() => {
    run.current++;
    setPhase(-1);
    setError(null);
    setResult(null);
  }, []);

  return { phase, error, result, start, reset, pendingTx: draft.publishTx ?? null };
}
