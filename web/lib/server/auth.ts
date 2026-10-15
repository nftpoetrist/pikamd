import "server-only";
import { cookies } from "next/headers";
import { TransactionReceiptNotFoundError, createPublicClient, http, type TransactionReceipt } from "viem";
import { SESSION_COOKIE, SESSION_TTL_S, assertSecret, createSessionToken, readSessionToken } from "@/lib/auth/session";
import { CHAIN, RPC_URL } from "@/lib/chain";

// Session cookie and signature checks for the routes under app/api (ARCHITECTURE §9.2, K22).

/** PIKAMD_SESSION_SECRET: signs session cookies and sign-in nonces (with separate labels). */
export function secret(): string {
  const value = process.env.PIKAMD_SESSION_SECRET;
  assertSecret(value);
  return value;
}

/** The signed-in wallet from the session cookie, or null. The only source of "who is this". */
export async function sessionWallet(): Promise<`0x${string}` | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSessionToken(token, secret(), new Date());
}

export async function startSession(address: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(address, secret(), new Date()), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// Server-side RPC for signature checks of smart-contract wallets (ERC-1271 / ERC-6492).
// Plain wallets are verified locally. ARC_RPC_URL can hold a keyed provider URL (server only).
export const arcClient = createPublicClient({ chain: CHAIN, transport: http(process.env.ARC_RPC_URL || RPC_URL) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A transaction's receipt from Arc, or null if the RPC still doesn't know it. Arc finalizes in
 * under a second (ARC.md §1); a few short waits cover an RPC that's a block behind.
 */
export async function fetchReceipt(hash: `0x${string}`, attempts = 6): Promise<TransactionReceipt | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await arcClient.getTransactionReceipt({ hash });
    } catch (error) {
      if (!(error instanceof TransactionReceiptNotFoundError) || attempt >= attempts) return null;
      await sleep(1000);
    }
  }
}
