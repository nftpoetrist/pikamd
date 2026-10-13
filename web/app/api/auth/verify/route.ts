import { verifySiweMessage } from "viem/siwe";
import { readNonce } from "@/lib/auth/nonce";
import { checkSiweMessage } from "@/lib/auth/siwe";
import { CHAIN } from "@/lib/chain";
import { arcClient, secret, startSession } from "@/lib/server/auth";
import { NO_STORE, notConfigured, readJson, sameOriginGuard } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

const SIGNATURE_RE = /^0x[0-9a-fA-F]{130,20000}$/; // 65-byte ECDSA, or a longer smart-wallet signature

// Step 2 of sign-in: checks the signed message and starts the session (HttpOnly cookie).
// Order: fields, then the nonce must be one this server signed and still valid, then the wallet
// signature, and only then the nonce is marked used. Nothing is written for a bad request, and a
// replayed message fails at the last step.
export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  const store = getStore();
  if (!store) return notConfigured();

  const body = await readJson(request);
  const message = body?.message;
  const signature = body?.signature;
  if (typeof message !== "string" || typeof signature !== "string" || !SIGNATURE_RE.test(signature)) {
    return Response.json({ error: "Send the signed message and its signature" }, { status: 400, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const checked = checkSiweMessage(message, { domain: url.host, origin: url.origin, chainId: CHAIN.id, now: new Date() });
  if ("error" in checked) return Response.json({ error: checked.error }, { status: 400, headers: NO_STORE });

  const issued = readNonce(checked.nonce, secret(), new Date());
  if (!issued) {
    return Response.json({ error: "This sign-in request expired, try again" }, { status: 400, headers: NO_STORE });
  }

  let valid: boolean;
  try {
    valid = await verifySiweMessage(arcClient, {
      message,
      signature: signature as `0x${string}`,
      address: checked.address,
      domain: url.host,
      nonce: checked.nonce,
    });
  } catch {
    return Response.json({ error: "Couldn't check the signature right now, try again" }, { status: 502, headers: NO_STORE });
  }
  if (!valid) return Response.json({ error: "The signature doesn't match this wallet" }, { status: 401, headers: NO_STORE });

  if (!(await store.useNonce(checked.nonce, issued.expiresAt))) {
    return Response.json({ error: "This sign-in request was already used, sign again" }, { status: 400, headers: NO_STORE });
  }

  await startSession(checked.address);
  return Response.json({ address: checked.address }, { headers: NO_STORE });
}
