import { sessionWallet } from "@/lib/server/auth";
import { activeKey, replaceKey, revokeKey } from "@/lib/server/collection";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabase } from "@/lib/server/supabase";

// The signed-in wallet's MCP key (K11, ARCHITECTURE §8). The browser makes the key and sends only
// its SHA-256 and masked form ("pmd_3f9a…c21e"): the key itself never reaches this server, and it
// can't be shown again. One active key per wallet; a new one revokes the old.
const HASH_RE = /^[0-9a-f]{64}$/;
const MASKED_RE = /^pmd_[0-9a-f]{4}…[0-9a-f]{4}$/;
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

async function signedWallet() {
  if (!supabase()) return { error: fail(503, "MCP keys aren't available on this server yet") };
  const wallet = await sessionWallet();
  if (!wallet) return { error: fail(401, "Sign in with your wallet to manage your key") };
  return { wallet };
}

export async function GET() {
  const s = await signedWallet();
  if (s.error) return s.error;
  return Response.json({ key: await activeKey(s.wallet) }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  const s = await signedWallet();
  if (s.error) return s.error;
  const limited = await rateLimited("mcpKey", { request, wallet: s.wallet });
  if (limited) return limited;

  const body = await readJson(request);
  const keyHash = body?.keyHash;
  const masked = body?.masked;
  if (typeof keyHash !== "string" || !HASH_RE.test(keyHash) || typeof masked !== "string" || !MASKED_RE.test(masked)) {
    return fail(400, "Send the key's SHA-256 and its masked form");
  }
  const key = await replaceKey(s.wallet, keyHash, masked);
  if (!key) return fail(409, "That key exists already. Create a new one");
  return Response.json({ key }, { headers: NO_STORE });
}

export async function DELETE(request: Request) {
  const rejected = sameOriginGuard(request, { json: false });
  if (rejected) return rejected;
  const s = await signedWallet();
  if (s.error) return s.error;
  const limited = await rateLimited("mcpKey", { request, wallet: s.wallet });
  if (limited) return limited;
  return Response.json({ revoked: await revokeKey(s.wallet) }, { headers: NO_STORE });
}
