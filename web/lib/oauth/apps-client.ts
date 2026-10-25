"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSignedIn } from "@/lib/collection/client";
import { api } from "@/lib/wallet/api";

// The wallet's connected apps in the browser (ARCHITECTURE §8.2): agents it allowed through sign-in.

export const APPS_KEY = ["oauth-apps"] as const;
export type ConnectedApp = { id: string; kind: "cimd" | "dcr"; name: string; host: string | null; createdAt: string; lastUsedAt: string | null };

export function useConnectedApps() {
  const { wallet, signed } = useSignedIn();
  return useQuery({
    queryKey: [...APPS_KEY, wallet?.toLowerCase()],
    queryFn: async () => (await api<{ apps: ConnectedApp[] }>("/api/oauth/apps")).apps,
    enabled: signed,
    staleTime: 15_000,
    refetchInterval: 60_000, // "last used" follows the agent
    retry: false,
  });
}

/** Disconnects one app: its tokens stop working at once. */
export function useDisconnectApp() {
  const client = useQueryClient();
  return useCallback(
    async (id: string) => {
      await api(`/api/oauth/apps/${encodeURIComponent(id)}`, { method: "DELETE" });
      await client.invalidateQueries({ queryKey: APPS_KEY });
    },
    [client],
  );
}
