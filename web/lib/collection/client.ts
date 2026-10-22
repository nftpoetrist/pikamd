"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useHydrated } from "@/lib/hydrated";
import { sameWallet } from "@/lib/likes/rules";
import { ApiError, api } from "@/lib/wallet/api";
import { useSessionWallet } from "@/lib/wallet/session";
import { useKnownWallet, useWalletUnknown } from "@/lib/wallet/known";

// The collection in the browser (K12): it belongs to the wallet and lives on the server, so the
// same list shows on any device and the wallet's MCP key opens it for agents. Reading and changing
// it needs the one free sign-in signature (like a like). The UI updates at once and takes the
// server's list after.

export const COLLECTION_KEY = ["collection"] as const;

export type Saved =
  | { state: "loading" }
  | { state: "disconnected" }
  /** Connected, but not signed in as this wallet: the list can't be read yet */
  | { state: "signed-out"; wallet: `0x${string}` }
  | { state: "ready"; wallet: `0x${string}`; slugs: string[] }
  | { state: "error"; wallet: `0x${string}`; error: unknown };

/** True when the connected wallet is the one signed in. */
export function useSignedIn(): { wallet: `0x${string}` | null; signed: boolean; pending: boolean } {
  const wallet = useKnownWallet();
  const session = useSessionWallet();
  return { wallet, signed: !!wallet && !!session.data && sameWallet(session.data, wallet), pending: session.isPending };
}

export function useSavedSlugs(): Saved {
  const hydrated = useHydrated();
  const unknown = useWalletUnknown();
  const { wallet, signed, pending } = useSignedIn();
  const list = useQuery({
    queryKey: [...COLLECTION_KEY, wallet?.toLowerCase()],
    queryFn: async () => (await api<{ slugs: string[] }>("/api/collection")).slugs,
    enabled: signed,
    staleTime: 30_000,
    retry: false,
  });
  // The server can't see the wallet: until hydration ends, render exactly what it rendered
  if (!hydrated || unknown) return { state: "loading" };
  if (!wallet) return { state: "disconnected" };
  if (pending) return { state: "loading" };
  if (!signed) return { state: "signed-out", wallet };
  if (list.data) return { state: "ready", wallet, slugs: list.data };
  if (list.error) return { state: "error", wallet, error: list.error };
  return { state: "loading" };
}

/** Saves (`save: true`) or removes a guideline. Optimistic, then the server's answer. */
export function useCollect() {
  const client = useQueryClient();
  const { wallet } = useSignedIn();
  const key = [...COLLECTION_KEY, wallet?.toLowerCase()];
  return useMutation({
    mutationFn: ({ slug, save }: { slug: string; save: boolean }) =>
      api<{ saved: boolean; changed: boolean; total: number }>(`/api/collection/${encodeURIComponent(slug)}`, { method: save ? "PUT" : "DELETE" }),
    onMutate: async ({ slug, save }) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<string[]>(key);
      if (previous) client.setQueryData<string[]>(key, save ? [slug, ...previous.filter((s) => s !== slug)] : previous.filter((s) => s !== slug));
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => void client.invalidateQueries({ queryKey: COLLECTION_KEY }),
  });
}

// Before collections were tied to wallets (until 2026-10-18), Explore saved slugs in this browser.
// The first time a wallet signs in here, they move into its collection, then the old copies go.
const LEGACY_COLLECTION = "pikamd:collection";
const LEGACY_KEY = "pikamd:mcp-key";
let importing = false;

export function useMoveLocalCollection() {
  const client = useQueryClient();
  const { wallet, signed } = useSignedIn();
  useEffect(() => {
    if (!signed || !wallet || importing) return;
    let slugs: string[] = [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(LEGACY_COLLECTION) ?? "[]");
      if (Array.isArray(parsed)) slugs = parsed.filter((s): s is string => typeof s === "string").slice(0, 100);
      localStorage.removeItem(LEGACY_KEY); // a demo key record: no real key behind it
    } catch {
      return; // storage blocked: nothing to move
    }
    if (slugs.length === 0) return;
    importing = true;
    void (async () => {
      // Oldest first, so the newest ends up on top as before. A guideline gone since (404) is
      // dropped; anything else (offline, rate limit) stays here for the next sign-in.
      const left: string[] = [];
      for (const slug of [...slugs].reverse()) {
        await api(`/api/collection/${encodeURIComponent(slug)}`, { method: "PUT" }).catch((e: unknown) => {
          if (!(e instanceof ApiError && e.status === 404)) left.unshift(slug);
        });
      }
      try {
        if (left.length) localStorage.setItem(LEGACY_COLLECTION, JSON.stringify(left));
        else localStorage.removeItem(LEGACY_COLLECTION);
      } catch {}
      importing = false;
      await client.invalidateQueries({ queryKey: COLLECTION_KEY });
    })();
  }, [signed, wallet, client]);
}
