// Sign-In With Ethereum (EIP-4361) rules for PikaMd sessions (ARCHITECTURE K3, K22).
// Pure and I/O-free so it runs in tests; the routes under app/api/auth wire it to the store.
import { getAddress, isAddress } from "viem";
import { createSiweMessage, parseSiweMessage } from "viem/siwe";

// No Node imports here: the browser builds the sign-in message from this file
// (lib/wallet/session.ts). Importing nonce.ts (node:crypto) would ship a crypto polyfill
// of ~500 KB to every page.

/** Sign-in nonce format (lib/auth/nonce.ts): 48 lowercase hex. */
export const NONCE_RE = /^[0-9a-f]{48}$/;

/** Shown in the wallet's signing prompt. Signing is free: no transaction, no gas. */
export const SIWE_STATEMENT = "Sign in to PikaMd. This is free: it doesn't send a transaction or cost gas.";

/** A nonce must be signed within this window and works once (ARCHITECTURE §9.2, lib/auth/nonce.ts). */
export const NONCE_TTL_MS = 5 * 60 * 1000;

/** Tolerated clock difference. The issue time comes from the server with the nonce
 * (/api/auth/nonce), so a wrong clock on the user's device can't make sign-in fail. */
const CLOCK_SKEW_MS = 60 * 1000;

export const isNonce = (value: unknown): value is string => typeof value === "string" && NONCE_RE.test(value);

export type SiweExpectations = {
  /** Host of the site the user is on, e.g. "pikamd.xyz" or "localhost:3001". */
  domain: string;
  /** Origin of the site, e.g. "https://pikamd.xyz". */
  origin: string;
  chainId: number;
  now: Date;
};

export type CheckedSiwe = { address: `0x${string}`; nonce: string };

/**
 * Checks every field of a signed-in message that viem's verifySiweMessage leaves out
 * (it doesn't look at chainId, uri, version, statement or issuedAt). Returns the signer and
 * nonce, or the reason the message is refused. The signature itself is checked separately.
 */
export function checkSiweMessage(message: string, expected: SiweExpectations): CheckedSiwe | { error: string } {
  if (typeof message !== "string" || message.length === 0 || message.length > 2000) return { error: "Invalid message" };

  const m = parseSiweMessage(message);
  const now = expected.now.getTime();

  if (m.domain !== expected.domain) return { error: "Message is for another site" };
  if (!m.uri || safeOrigin(m.uri) !== expected.origin) return { error: "Message is for another site" };
  if (m.version !== "1") return { error: "Unsupported message version" };
  if (m.chainId !== expected.chainId) return { error: "Message is for another network" };
  if (m.statement !== SIWE_STATEMENT) return { error: "Unexpected message text" };
  if (!m.address || !isAddress(m.address, { strict: false })) return { error: "Invalid address" };
  if (!isNonce(m.nonce)) return { error: "Invalid nonce" };

  const issued = m.issuedAt?.getTime();
  if (issued === undefined || Number.isNaN(issued)) return { error: "Missing issue time" };
  if (issued > now + CLOCK_SKEW_MS || now - issued > NONCE_TTL_MS + CLOCK_SKEW_MS) return { error: "Message expired, sign again" };
  if (m.expirationTime && !(m.expirationTime.getTime() > now)) return { error: "Message expired, sign again" };
  if (m.notBefore && !(m.notBefore.getTime() <= now + CLOCK_SKEW_MS)) return { error: "Message isn't valid yet" };

  // Canonical form only: the parser ignores anything it doesn't recognize, so the signed text must
  // be exactly what buildSiweMessage makes from these fields (no scheme, request id or resources).
  let canonical: string;
  try {
    canonical = buildSiweMessage({
      address: m.address,
      chainId: m.chainId,
      domain: m.domain,
      origin: expected.origin,
      nonce: m.nonce,
      issuedAt: m.issuedAt!,
      expirationTime: m.expirationTime,
      notBefore: m.notBefore,
    });
  } catch {
    return { error: "Invalid message" };
  }
  if (canonical !== message) return { error: "Unexpected message format" };

  return { address: getAddress(m.address), nonce: m.nonce };
}

/** The exact message the browser asks the wallet to sign (and the only form the server accepts). */
export function buildSiweMessage(p: {
  address: `0x${string}`;
  chainId: number;
  domain: string;
  origin: string;
  nonce: string;
  issuedAt: Date;
  expirationTime?: Date;
  notBefore?: Date;
}): string {
  return createSiweMessage({
    address: p.address,
    chainId: p.chainId,
    domain: p.domain,
    uri: p.origin,
    version: "1",
    nonce: p.nonce,
    statement: SIWE_STATEMENT,
    issuedAt: p.issuedAt,
    expirationTime: p.expirationTime,
    notBefore: p.notBefore,
  });
}

function safeOrigin(uri: string): string | null {
  try {
    return new URL(uri).origin;
  } catch {
    return null;
  }
}
