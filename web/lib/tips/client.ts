"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { BaseError, ContractFunctionRevertedError, WaitForTransactionReceiptTimeoutError, erc20Abi } from "viem";
import { getChainId, readContract, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { suggestedFees } from "@/lib/wallet/fees";
import { CHAIN, REGISTRY, TIPS, USDC } from "@/lib/chain";
import { sameWallet } from "@/lib/likes/rules";
import { messageFor } from "@/lib/publish/client";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import { TIPS_ABI } from "@/lib/tips-abi";
import { FEE_RESERVE, formatBalance, formatUsdc } from "@/lib/tips/amount";
import type { TipTarget } from "@/lib/tips/dialog";
import { api, isUserRejection } from "@/lib/wallet/api";
import { wagmiConfig } from "@/lib/wallet/config";

// A tip in the browser (K21): the tipper's own wallet sends USDC to the guideline's author through
// GuidelineTips, which reads the author from the registry itself. Before any wallet prompt the flow
// checks on Arc what the contract will check (author, listed, not their own) and the balance, and
// simulates the tip, so a tip that would fail is explained instead of sent. The approval is for the
// exact amount and is skipped when the wallet already allowed enough. Closing the dialog stops the
// flow before its next wallet prompt; a tip already sent still finishes and is recorded.

export type TipPhase = "checking" | "approve" | "approving" | "tip" | "sending" | "done";
export type TipResult = { txHash: `0x${string}`; amount: bigint; author: `0x${string}` };

/** Receipts on Arc take under a second (ARC.md §1); past this something is wrong with the RPC. */
const RECEIPT_TIMEOUT_MS = 60_000;
const FAUCET = "https://faucet.circle.com";

/** The registry's errors too: GuidelineTips calls getGuideline, so UnknownGuideline can come back. */
const TIP_CALL_ABI = [...TIPS_ABI, ...REGISTRY_ABI.filter((item) => item.type === "error")] as const;

/** An error whose message is already written for the user. */
class TipError extends Error {}

const needFees = (has: bigint, amount: bigint) =>
  `Your wallet has ${formatBalance(has)} USDC. A ${formatUsdc(amount)} USDC tip also needs a little for network fees` +
  (CHAIN.testnet ? `. Get testnet USDC at ${FAUCET}` : "");

/** A short, honest message for whatever stopped the tip. */
export function tipMessage(error: unknown): string {
  if (isUserRejection(error)) return "You cancelled in your wallet. Nothing was sent";
  if (error instanceof TipError) return error.message;
  if (error instanceof WaitForTransactionReceiptTimeoutError) {
    return "Arc is taking longer than usual. Check your wallet's activity before you try again";
  }
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name === "NotListed") return "This guideline isn't listed right now, so it can't receive tips";
      if (name === "SelfTip") return "This is your own guideline";
      if (name === "TipTooSmall") return "The smallest tip is 0.01 USDC";
      if (name === "UnknownGuideline") return "This guideline isn't on Arc, so it can't receive tips";
      const reason = revert.reason ?? "";
      if (/blocked|blacklist|blocklist/i.test(reason)) return "USDC can't move to or from one of these wallets (USDC blocklist), so the tip can't be sent";
      if (/allowance/i.test(reason)) return "Your wallet allowed less than the tip. Try again and keep the amount as it is";
      if (/balance/i.test(reason)) return "Your wallet doesn't hold enough USDC for this tip";
      if (/paused/i.test(reason)) return "USDC transfers are paused right now. Try again later";
    }
  }
  return messageFor(error);
}

export function useTipFlow() {
  const client = useQueryClient();
  const [phase, setPhase] = useState<TipPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TipResult | null>(null);
  const [needsApproval, setNeedsApproval] = useState<boolean | null>(null);
  const [tx, setTx] = useState<`0x${string}` | null>(null);
  // Each run gets a number; reset() or unmounting moves it on, and an outdated run stops before its
  // next prompt (a tip already sent still finishes and is recorded)
  const runs = useRef(0);
  useEffect(() => {
    const current = runs;
    return () => {
      current.current++;
    };
  }, []);

  const send = useCallback(
    async (target: TipTarget, amount: bigint, wallet: `0x${string}`) => {
      const run = ++runs.current;
      const alive = () => runs.current === run;
      setError(null);
      setResult(null);
      setTx(null);
      setNeedsApproval(null);
      try {
        if (!TIPS || !REGISTRY) throw new TipError("Tips aren't live on this network yet");
        const tips = TIPS.address;
        setPhase("checking");
        if (getChainId(wagmiConfig) !== CHAIN.id) await switchChain(wagmiConfig, { chainId: CHAIN.id });
        if (!alive()) return;

        // What the contract will check, read from Arc now
        const read = { chainId: CHAIN.id } as const;
        const [onChain, balance, allowance] = await Promise.all([
          readContract(wagmiConfig, { ...read, address: REGISTRY.address, abi: REGISTRY_ABI, functionName: "getGuideline", args: [BigInt(target.id)] }),
          readContract(wagmiConfig, { ...read, address: USDC.address, abi: erc20Abi, functionName: "balanceOf", args: [wallet] }),
          readContract(wagmiConfig, { ...read, address: USDC.address, abi: erc20Abi, functionName: "allowance", args: [wallet, tips] }),
        ]);
        if (!sameWallet(onChain.author, target.author)) {
          throw new TipError("PikaMd's record of this author doesn't match Arc, so tips for it are paused");
        }
        if (onChain.authorHidden || onChain.moderatorLocked) throw new TipError("This guideline isn't listed right now, so it can't receive tips");
        if (sameWallet(onChain.author, wallet)) throw new TipError("This is your own guideline");
        if (balance < amount + FEE_RESERVE) throw new TipError(needFees(balance, amount));
        if (!alive()) return;

        if (allowance < amount) {
          setNeedsApproval(true);
          setPhase("approve");
          const approval = await writeContract(wagmiConfig, { ...read, address: USDC.address, abi: erc20Abi, functionName: "approve", args: [tips, amount], ...(await suggestedFees()) });
          // Confirmed after the dialog closed: the approval stands (only this wallet can use it), nothing follows
          if (!alive()) return;
          setPhase("approving");
          const approved = await waitForTransactionReceipt(wagmiConfig, { ...read, hash: approval, timeout: RECEIPT_TIMEOUT_MS });
          if (approved.status !== "success") throw new TipError("The approval failed on Arc, so nothing was sent. Try again");
          if (!alive()) return;
          // Some wallets let people edit the amount they allow
          const allowed = await readContract(wagmiConfig, { ...read, address: USDC.address, abi: erc20Abi, functionName: "allowance", args: [wallet, tips] });
          if (allowed < amount) throw new TipError(`Your wallet allowed ${formatUsdc(allowed)} USDC, less than the tip. Try again and keep the amount as it is`);
        } else {
          setNeedsApproval(false);
        }
        if (!alive()) return;

        setPhase("tip");
        const call = { ...read, address: tips, abi: TIP_CALL_ABI, functionName: "tip", args: [BigInt(target.id), amount], account: wallet } as const;
        // Simulated without fee fields (eth_call stays a plain dry run); the same call is then sent with them
        await simulateContract(wagmiConfig, call);
        if (!alive()) return;
        const hash = await writeContract(wagmiConfig, { ...call, ...(await suggestedFees()) });
        // Sent: from here it finishes even if the dialog closed
        if (alive()) {
          setTx(hash);
          setPhase("sending");
        }
        const receipt = await waitForTransactionReceipt(wagmiConfig, { ...read, hash, timeout: RECEIPT_TIMEOUT_MS });
        if (receipt.status !== "success") throw new TipError("The tip failed on Arc, so nothing was sent. Try again");

        // Into the index now (the indexer would find it later anyway); nothing on Arc depends on it
        void api("/api/tips/record", { method: "POST", body: { txHash: hash } })
          .catch(() => {})
          .finally(() => void client.invalidateQueries({ queryKey: ["profile"] }));
        if (alive()) {
          setResult({ txHash: hash, amount, author: onChain.author });
          setPhase("done");
        }
      } catch (e) {
        if (!alive()) return;
        setError(tipMessage(e));
        setPhase(null);
      }
    },
    [client],
  );

  /** Back to the start; a run in progress stops before its next wallet prompt. */
  const reset = useCallback(() => {
    runs.current++;
    setPhase(null);
    setError(null);
    setResult(null);
    setTx(null);
    setNeedsApproval(null);
  }, []);

  return { phase, busy: phase !== null && phase !== "done", error, result, needsApproval, tx, send, reset };
}
