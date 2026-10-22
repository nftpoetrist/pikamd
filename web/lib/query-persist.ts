"use client";

import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

// The last server answers this browser saw, for a returning visitor (per-viewer convenience): the
// session, saved list, MCP key facts, PikaGold, own guidelines, likes and the moderation desk.
// Restored right after hydration (never during it: the server rendered without them), so a page
// shows them at once while every query still refetches and quietly replaces them. Secrets never
// get here: the full MCP key is never in the cache, only its masked form.

const KEY = "pikamd:query-cache";
const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a sign-in lasts a week
const PERSISTED = new Set(["session", "collection", "mcp-key", "profile", "owned", "likes", "mod"]);
const SAVE_DELAY_MS = 500;

type Stored = { v: number; at: number; state: ReturnType<typeof dehydrate> };

/** Restores the stored answers (older than what's in the cache never wins), then keeps them saved. */
export function persistQueries(client: QueryClient): () => void {
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Stored) : null;
    if (stored && stored.v === VERSION && Date.now() - stored.at < MAX_AGE_MS) hydrate(client, stored.state);
  } catch {
    // Blocked or broken storage: start without it
  }

  let timer: number | undefined;
  const save = () => {
    try {
      const state = dehydrate(client, {
        shouldDehydrateQuery: (q) => q.state.status === "success" && PERSISTED.has(String(q.queryKey[0])),
      });
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, at: Date.now(), state } satisfies Stored));
    } catch {
      // Storage full or blocked: this visit still works from memory
    }
  };
  const unsubscribe = client.getQueryCache().subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(save, SAVE_DELAY_MS);
  });
  return () => {
    unsubscribe();
    window.clearTimeout(timer);
  };
}
