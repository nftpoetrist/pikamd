"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSignedIn } from "@/lib/collection/client";
import { createKey, hashKey, maskKey } from "@/lib/mcp/connect";
import { api } from "@/lib/wallet/api";

// The wallet's MCP key in the browser (K11, ARCHITECTURE §8). The key is made here and shown once;
// the server gets only its SHA-256 and masked form, so it can never show it again or leak it.

export const MCP_KEY = ["mcp-key"] as const;
export type KeyInfo = { masked: string; createdAt: string; lastUsedAt: string | null };

/** The active key's public facts (null: none), once signed in as the connected wallet. */
export function useMcpKey() {
  const { wallet, signed } = useSignedIn();
  return useQuery({
    queryKey: [...MCP_KEY, wallet?.toLowerCase()],
    queryFn: async () => (await api<{ key: KeyInfo | null }>("/api/mcp-key")).key,
    enabled: signed,
    staleTime: 15_000,
    refetchInterval: 60_000, // "last used" follows the agent
    retry: false,
  });
}

export function useKeyActions() {
  const client = useQueryClient();
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: MCP_KEY }), [client]);

  /** A new key for the wallet (the old one stops working). Returns the key, to show once. */
  const create = useCallback(async () => {
    const key = createKey();
    await api("/api/mcp-key", { method: "POST", body: { keyHash: await hashKey(key), masked: maskKey(key) } });
    await refresh();
    return key;
  }, [refresh]);

  const revoke = useCallback(async () => {
    await api("/api/mcp-key", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return { create, revoke };
}
