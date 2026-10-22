"use client";

import { useConnection } from "wagmi";

/**
 * The wallet to show: the connected one, or the one wagmi is reconnecting from the last visit
 * (it keeps that address in storage and reports it while reconnecting), so a returning visitor
 * doesn't see "Connect Wallet" flash first. For display only: anything that sends a transaction
 * or a signature waits for status "connected".
 */
export function useKnownWallet(): `0x${string}` | null {
  const { address, status } = useConnection();
  return (status === "connected" || status === "reconnecting") && address ? address : null;
}

/** True while wagmi doesn't know yet whether there is a wallet at all. */
export function useWalletUnknown(): boolean {
  const { address, status } = useConnection();
  return status === "connecting" || (status === "reconnecting" && !address);
}
