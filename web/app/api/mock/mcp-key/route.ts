import { cleanSlugs, mockGuard } from "@/lib/mcp/mock-api";
import { readJson } from "@/lib/server/guard";
import { clearKeyHash, setCollection, setKeyHash } from "@/lib/mcp/mock-store";

// Local preview (Connect page): register the SHA-256 hash of a new key, never the key itself.
// A new hash replaces the old one, so the previous key stops working. Body: { keyHash, collection? }
export async function POST(request: Request) {
  const rejected = mockGuard(request, { json: true });
  if (rejected) return rejected;

  const body = await readJson(request, 128 * 1024);
  const keyHash = body?.keyHash;
  if (typeof keyHash !== "string" || !/^[0-9a-f]{64}$/.test(keyHash)) {
    return Response.json({ error: "keyHash must be a SHA-256 hex digest" }, { status: 400 });
  }
  const collection = body && "collection" in body ? await cleanSlugs(body.collection) : undefined;
  if (collection === null) return Response.json({ error: "collection must be a list of slugs" }, { status: 400 });

  await setKeyHash(keyHash);
  if (collection) await setCollection(collection);
  return Response.json({ ok: true });
}

// Revoke: the active key stops working right away.
export async function DELETE(request: Request) {
  const rejected = mockGuard(request, { json: false });
  if (rejected) return rejected;
  await clearKeyHash();
  return Response.json({ ok: true });
}
