import "server-only";
import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashKey, isKey } from "@/lib/mcp/connect";

// Local preview store for the MCP server (roadmap step 8 pulled forward, mock data).
// Wallet sign-in doesn't exist yet, so this computer has one demo user: one active key hash
// and one collection, kept in web/.data/ (git-ignored). Replaced by Supabase (mcp_keys,
// collections tables, ARCHITECTURE §10) with SIWE sessions. Never enabled in production.
export const MOCK_ENABLED = process.env.NODE_ENV !== "production";

type MockState = { keyHash: string | null; collection: string[] };

const FILE = path.join(process.cwd(), ".data", "mock-mcp.json");
const EMPTY: MockState = { keyHash: null, collection: [] };

async function load(): Promise<MockState> {
  try {
    const parsed: unknown = JSON.parse(await readFile(FILE, "utf8"));
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const { keyHash, collection } = parsed as Partial<MockState>;
    return {
      keyHash: typeof keyHash === "string" && /^[0-9a-f]{64}$/.test(keyHash) ? keyHash : null,
      collection: Array.isArray(collection) ? collection.filter((s): s is string => typeof s === "string") : [],
    };
  } catch {
    return EMPTY; // no file yet, or unreadable: start empty
  }
}

// Writes go one at a time (key and collection updates can arrive together), and land atomically.
let queue: Promise<unknown> = Promise.resolve();
function update(change: (state: MockState) => MockState): Promise<void> {
  const run = queue.then(async () => {
    const next = change(await load());
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
    await rename(tmp, FILE);
  });
  queue = run.catch(() => {});
  return run;
}

/** One active key, like "Create a new key" in the UI: a new hash replaces the old one. */
export const setKeyHash = (keyHash: string) => update((s) => ({ ...s, keyHash }));
export const clearKeyHash = () => update((s) => ({ ...s, keyHash: null }));
export const setCollection = (collection: string[]) => update((s) => ({ ...s, collection }));

/** The demo user's collection if `token` is the active key, otherwise null. */
export async function collectionForKey(token: string): Promise<string[] | null> {
  if (!MOCK_ENABLED || !isKey(token)) return null;
  const state = await load();
  if (!state.keyHash) return null;
  const given = Buffer.from(await hashKey(token), "hex");
  const stored = Buffer.from(state.keyHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored) ? state.collection : null;
}
