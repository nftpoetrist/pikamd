import { NONCE_TTL_MS, newNonce } from "@/lib/auth/siwe";
import { NO_STORE, notConfigured, sameOriginGuard } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

// Step 1 of sign-in: a fresh single-use nonce, and the issue time, for the message the wallet signs.
// POST, so the browser sends an Origin header the guard can check.
export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: false });
  if (rejected) return rejected;
  const store = getStore();
  if (!store) return notConfigured();

  const nonce = newNonce();
  const issuedAt = new Date();
  if (!(await store.saveNonce(nonce, new Date(issuedAt.getTime() + NONCE_TTL_MS)))) {
    return Response.json({ error: "Too many sign-in attempts, try again in a few minutes" }, { status: 429, headers: NO_STORE });
  }
  // The message's issue time comes from here, not from the user's device clock
  return Response.json({ nonce, issuedAt: issuedAt.toISOString() }, { headers: NO_STORE });
}
