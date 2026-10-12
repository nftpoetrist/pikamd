import "server-only";
import { timingSafeEqual } from "node:crypto";
import { hashKey, isKey } from "@/lib/mcp/connect";
import { jsonFileStore } from "@/lib/server/json-file";

// Local preview store for the MCP server (roadmap step 8 pulled forward, mock data).
// Wallet sign-in doesn't exist yet, so this computer has one demo user: one active key hash
// and one collection, kept in web/.data/ (git-ignored). Replaced by Supabase (mcp_keys,
// collections tables, ARCHITECTURE §10) with SIWE sessions. Never enabled in production.
export const MOCK_ENABLED = process.env.NODE_ENV !== "production";

type MockState = { keyHash: string | null; collection: string[] };

const EMPTY: MockState = { keyHash: null, collection: [] };

const store = jsonFileStore<MockState>("mock-mcp.json", (parsed) => {
  if (!parsed || typeof parsed !== "object") return EMPTY;
  const { keyHash, collection } = parsed as Partial<MockState>;
  return {
    keyHash: typeof keyHash === "string" && /^[0-9a-f]{64}$/.test(keyHash) ? keyHash : null,
    collection: Array.isArray(collection) ? collection.filter((s): s is string => typeof s === "string") : [],
  };
});

// Key and collection updates can arrive together; the store applies them one at a time.
const update = (change: (state: MockState) => MockState) =>
  store.update((state) => ({ next: change(state), result: undefined }));

/** One active key, like "Create a new key" in the UI: a new hash replaces the old one. */
export const setKeyHash = (keyHash: string) => update((s) => ({ ...s, keyHash }));
export const clearKeyHash = () => update((s) => ({ ...s, keyHash: null }));
export const setCollection = (collection: string[]) => update((s) => ({ ...s, collection }));

/** The demo user's collection if `token` is the active key, otherwise null. */
export async function collectionForKey(token: string): Promise<string[] | null> {
  if (!MOCK_ENABLED || !isKey(token)) return null;
  const state = await store.read();
  if (!state.keyHash) return null;
  const given = Buffer.from(await hashKey(token), "hex");
  const stored = Buffer.from(state.keyHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored) ? state.collection : null;
}
