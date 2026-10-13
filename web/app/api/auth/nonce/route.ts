import { issueNonce } from "@/lib/auth/nonce";
import { NONCE_TTL_MS } from "@/lib/auth/siwe";
import { secret } from "@/lib/server/auth";
import { NO_STORE, notConfigured, sameOriginGuard } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

// Step 1 of sign-in: a server-signed nonce (lib/auth/nonce.ts) and the issue time for the message
// the wallet signs. Nothing is stored here, so this public endpoint can't fill the database.
// POST, so the browser sends an Origin header the guard can check.
export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: false });
  if (rejected) return rejected;
  if (!getStore()) return notConfigured();

  const issuedAt = new Date();
  const { nonce } = issueNonce(secret(), issuedAt, NONCE_TTL_MS);
  // The message's issue time comes from here, not from the user's device clock
  return Response.json({ nonce, issuedAt: issuedAt.toISOString() }, { headers: NO_STORE });
}
