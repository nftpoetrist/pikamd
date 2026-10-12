// Session token for a signed-in wallet (ARCHITECTURE §9.2, K22): an HMAC-SHA256-signed payload
// in an HttpOnly cookie. The wallet address is only ever read from here, never from a request
// body. Pure (secret and time are parameters) so it runs in tests; app/api/auth sets the cookie.
import { createHmac, timingSafeEqual } from "node:crypto";
import { getAddress, isAddress } from "viem";

export const SESSION_COOKIE = "pikamd_session";
export const SESSION_TTL_S = 7 * 24 * 60 * 60; // a week; signing in again is one free signature

/** Payload format version: bump it to invalidate every existing session. */
const VERSION = 1;
const MIN_SECRET_LENGTH = 32;

type Payload = { v: number; a: string; iat: number; exp: number };

export function assertSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`PIKAMD_SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} random characters`);
  }
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");
const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest();

export function createSessionToken(address: string, secret: string, now: Date): string {
  assertSecret(secret);
  if (!isAddress(address, { strict: false })) throw new Error("Invalid address");
  const iat = Math.floor(now.getTime() / 1000);
  const payload: Payload = { v: VERSION, a: getAddress(address), iat, exp: iat + SESSION_TTL_S };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(sign(body, secret))}`;
}

/** The checksummed wallet address if the token is authentic and unexpired, otherwise null. */
export function readSessionToken(token: string | undefined, secret: string, now: Date): `0x${string}` | null {
  assertSecret(secret);
  if (!token || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;

  // Compare the exact text, not decoded bytes: base64 ignores a few trailing bits, so several
  // spellings decode to the same MAC. Only the one this server wrote is accepted.
  const expected = Buffer.from(b64url(sign(body, secret)));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let payload: Partial<Payload>;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const t = Math.floor(now.getTime() / 1000);
  if (payload.v !== VERSION || typeof payload.exp !== "number" || payload.exp <= t) return null;
  if (typeof payload.a !== "string" || !isAddress(payload.a, { strict: false })) return null;
  return getAddress(payload.a);
}
