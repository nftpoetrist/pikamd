"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useConnection, useConnectionEffect, useSignMessage } from "wagmi";
import { buildSiweMessage } from "@/lib/auth/siwe";
import { CHAIN } from "@/lib/chain";
import { sameWallet } from "@/lib/likes/rules";
import { api } from "@/lib/wallet/api";

// Wallet session in the browser (K22): connecting shows the profile without any signature;
// the first like asks for one free SIWE signature, and the server keeps the session in an
// HttpOnly cookie for a week. The browser never decides who is signed in: /api/auth/me does.

export const SESSION_KEY = ["session"] as const;

/** The signed-in wallet (null if none), from the server. `undefined` while loading. */
export function useSessionWallet() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => (await api<{ address: `0x${string}` | null }>("/api/auth/me")).address,
    staleTime: 60_000,
    retry: false,
  });
}

// One sign-in at a time, even if several buttons ask together.
let pending: Promise<`0x${string}`> | null = null;

/** Asks the wallet for the sign-in signature and starts the session. Resolves to the wallet. */
export function useSignIn() {
  const client = useQueryClient();
  const { mutateAsync: signMessage } = useSignMessage();

  return useCallback(
    (address: `0x${string}`) => {
      pending ??= (async () => {
        const { nonce, issuedAt } = await api<{ nonce: string; issuedAt: string }>("/api/auth/nonce", { method: "POST" });
        const message = buildSiweMessage({
          address,
          chainId: CHAIN.id,
          domain: window.location.host,
          origin: window.location.origin,
          nonce,
          issuedAt: new Date(issuedAt), // server time: the device clock may be off
        });
        const signature = await signMessage({ message, account: address });
        const res = await api<{ address: `0x${string}` }>("/api/auth/verify", { method: "POST", body: { message, signature } });
        client.setQueryData(SESSION_KEY, res.address);
        // "Liked by me" belongs to the new wallet now
        await client.invalidateQueries({ queryKey: ["likes"] });
        return res.address;
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
    [client, signMessage],
  );
}

/**
 * Keeps the server session in step with the wallet: it ends when the wallet disconnects (the
 * next person on this computer can't act as them) or switches to another account (the session
 * only ever speaks for the connected account).
 */
export function useSessionFollowsWallet() {
  const client = useQueryClient();
  const { address, status } = useConnection();
  const { data: session } = useSessionWallet();

  const end = useCallback(
    (only?: `0x${string}`) => {
      client.setQueryData(SESSION_KEY, null);
      void api("/api/auth/logout", { method: "POST", body: only ? { address: only } : {} })
        .catch(() => {})
        .finally(() => client.invalidateQueries({ queryKey: ["likes"] }));
    },
    [client],
  );

  useConnectionEffect({ onDisconnect: () => end() });

  useEffect(() => {
    if (status === "connected" && address && session && !sameWallet(address, session)) end(session);
  }, [status, address, session, end]);
}
