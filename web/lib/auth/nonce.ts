// Sign-in nonces signed by the server instead of stored (ARCHITECTURE §9.3). Issuing one writes
// nothing, so the public nonce endpoint can't be used to fill the database or block sign-ins.
// The server recognises its own nonces by the MAC and knows their expiry; only a nonce that a
// valid wallet signature used is remembered (until it expires) to stop replays.
// Format: 48 lowercase hex = 16 random + 8 expiry (unix seconds) + 24 MAC (96-bit HMAC-SHA256).
import { createHmac, timingSafeEqual } from "node:crypto";
import { assertSecret } from "./session.ts";

export const NONCE_RE = /^[0-9a-f]{48}$/;

// Domain separation: the session secret also signs session cookies
const LABEL = "pikamd:siwe-nonce:v1:";
const mac = (secret: string, body: string) => createHmac("sha256", secret).update(LABEL + body).digest("hex").slice(0, 24);

export function issueNonce(secret: string, now: Date, ttlMs: number): { nonce: string; expiresAt: Date } {
  assertSecret(secret);
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  const exp = Math.floor((now.getTime() + ttlMs) / 1000);
  const body = random + exp.toString(16).padStart(8, "0");
  return { nonce: body + mac(secret, body), expiresAt: new Date(exp * 1000) };
}

/** The nonce's expiry if this server issued it and it hasn't expired, otherwise null. */
export function readNonce(nonce: string, secret: string, now: Date): { expiresAt: Date } | null {
  assertSecret(secret);
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) return null;
  const body = nonce.slice(0, 24);
  const given = Buffer.from(nonce.slice(24));
  const expected = Buffer.from(mac(secret, body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const expiresAt = new Date(parseInt(body.slice(16), 16) * 1000);
  return expiresAt.getTime() > now.getTime() ? { expiresAt } : null;
}
