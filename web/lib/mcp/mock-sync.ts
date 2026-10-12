// Browser side of the local MCP preview (see lib/mcp/mock-store.ts). Sends the key's hash and the
// collection to this dev server so the MCP route can answer my_collection. Production has no
// mock endpoints yet, so these calls are skipped there and the Connect page stays a UI demo.
export const MOCK_SERVER = process.env.NODE_ENV !== "production";

async function send(path: string, method: string, body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Registers a new key (hash only) and the current collection. True when the server stored it. */
export async function registerKeyHash(keyHash: string, collection: readonly string[]): Promise<boolean> {
  return MOCK_SERVER ? send("/api/mock/mcp-key", "POST", { keyHash, collection }) : true;
}

export async function revokeKeyOnServer(): Promise<boolean> {
  return MOCK_SERVER ? send("/api/mock/mcp-key", "DELETE") : true;
}

/** Fire and forget: the next change or the Connect page sends it again if this one fails. */
export function syncCollection(collection: readonly string[]): void {
  if (MOCK_SERVER) void send("/api/mock/collection", "PUT", { collection });
}
