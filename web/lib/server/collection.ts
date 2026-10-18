import "server-only";
import { hashKey, isKey } from "@/lib/mcp/connect";
import { check, supabase } from "@/lib/server/supabase";

// Collections and MCP keys tied to wallets (K11, K12; web/supabase/migrations/20261018090000_collections_and_keys.sql).
// Callers pass the wallet from the signed session only, never from a request body. The MCP route
// gets the wallet from the key itself.

/** The collection holds at most this many guidelines (the database enforces it). */
export const COLLECTION_LIMIT = 500;

export type CollectionChange = { changed: boolean; total: number };

/** Saved slugs that are listed now, newest first. */
export async function collectionSlugs(wallet: string): Promise<string[]> {
  return (check(await supabase()!.rpc("collection_slugs", { p_wallet: wallet.toLowerCase() }), "collection_slugs") ?? []) as string[];
}

/** Null: not a listed guideline. "full": the wallet already saved COLLECTION_LIMIT guidelines. */
export async function addToCollection(wallet: string, slug: string): Promise<CollectionChange | null | "full"> {
  const res = await supabase()!.rpc("add_to_collection", { p_wallet: wallet.toLowerCase(), p_slug: slug });
  if (res.error?.code === "P0002") return null;
  if (res.error?.code === "PM001") return "full";
  const [row] = check(res, "add_to_collection") as { added: boolean; total: number }[];
  return { changed: row.added === true, total: Number(row.total) };
}

export async function removeFromCollection(wallet: string, slug: string): Promise<CollectionChange> {
  const [row] = check(await supabase()!.rpc("remove_from_collection", { p_wallet: wallet.toLowerCase(), p_slug: slug }), "remove_from_collection") as {
    removed: boolean;
    total: number;
  }[];
  return { changed: row.removed === true, total: Number(row.total) };
}

export type KeyInfo = { masked: string; createdAt: string; lastUsedAt: string | null };

export async function activeKey(wallet: string): Promise<KeyInfo | null> {
  const [row] = (check(await supabase()!.rpc("mcp_key_info", { p_wallet: wallet.toLowerCase() }), "mcp_key_info") ?? []) as {
    masked: string;
    created_at: string;
    last_used_at: string | null;
  }[];
  return row ? { masked: row.masked, createdAt: row.created_at, lastUsedAt: row.last_used_at } : null;
}

/** Stores a new key's hash for the wallet; the previous key stops working. Null if that hash exists. */
export async function replaceKey(wallet: string, keyHash: string, masked: string): Promise<KeyInfo | null> {
  const res = await supabase()!.rpc("replace_mcp_key", { p_wallet: wallet.toLowerCase(), p_hash: keyHash, p_masked: masked });
  if (res.error?.code === "23505") return null;
  const [row] = check(res, "replace_mcp_key") as { masked: string; created_at: string }[];
  return { masked: row.masked, createdAt: row.created_at, lastUsedAt: null };
}

export async function revokeKey(wallet: string): Promise<boolean> {
  return check(await supabase()!.rpc("revoke_mcp_key", { p_wallet: wallet.toLowerCase() }), "revoke_mcp_key") === true;
}

/**
 * The collection behind an MCP key, or null for a malformed, unknown or revoked key (or no
 * database). Only the key's SHA-256 reaches the database.
 */
export async function collectionForKey(token: string): Promise<string[] | null> {
  const db = supabase();
  if (!db || !isKey(token)) return null;
  const rows = (check(await db.rpc("mcp_key_collection", { p_hash: await hashKey(token) }), "mcp_key_collection") ?? []) as {
    wallet: string;
    slugs: string[];
  }[];
  return rows[0] ? rows[0].slugs.filter((s) => typeof s === "string") : null;
}
