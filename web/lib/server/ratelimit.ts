import "server-only";
import { createHmac } from "node:crypto";
import { NO_STORE } from "@/lib/server/guard";
import { supabase } from "@/lib/server/supabase";

// Rate limits for the write endpoints (web/supabase/migrations/20261015130000_rate_limits.sql).
// Reads are limited at the edge by a Vercel WAF rule. Client IPs are never stored as they are:
// the key holds an HMAC of the IP. On Vercel the IP header can't be spoofed (Vercel overwrites
// x-forwarded-for, vercel.com/docs/headers/request-headers).

const RULES = {
  /** Sign-in attempts: each one may cost an RPC call (smart-wallet signatures). */
  verify: { max: 20, windowS: 10 * 60, by: "ip" },
  /** Prepares pin a file to IPFS: per wallet and per IP. */
  prepareWallet: { max: 20, windowS: 60 * 60, by: "wallet" },
  prepareIp: { max: 40, windowS: 60 * 60, by: "ip" },
  /** Confirms read a receipt from Arc, retrying for a few seconds. */
  confirm: { max: 30, windowS: 10 * 60, by: "wallet" },
  /** Likes and unlikes. */
  like: { max: 120, windowS: 10 * 60, by: "wallet" },
  /** Hide / show syncs read a receipt and the guideline from Arc. */
  visibility: { max: 30, windowS: 10 * 60, by: "wallet" },
  /** Tip records read a receipt from Arc. No sign-in for a tip, so per IP. */
  tipRecord: { max: 30, windowS: 10 * 60, by: "ip" },
  /** Saving and removing collection items. */
  collect: { max: 120, windowS: 10 * 60, by: "wallet" },
  /** Creating and revoking MCP keys. */
  mcpKey: { max: 20, windowS: 60 * 60, by: "wallet" },
  /** Reports: one per guideline per wallet anyway; this caps a wallet reporting everything. */
  report: { max: 20, windowS: 60 * 60, by: "wallet" },
  /** Moderator actions (each checks the role on Arc first). */
  moderate: { max: 120, windowS: 10 * 60, by: "wallet" },
  /** OAuth (ARCHITECTURE §8.2). Dynamic client registrations: a client registers once per install. */
  oauthRegister: { max: 20, windowS: 60 * 60, by: "ip" },
  /** Authorization requests: each may fetch a client metadata document. */
  oauthAuthorize: { max: 60, windowS: 10 * 60, by: "ip" },
  /**
   * Code exchanges, refreshes and revocations. An agent refreshes about once an hour, but claude.ai
   * calls from Anthropic's shared range (160.79.104.0/21) for every user, so the cap leaves room
   * for about 3,000 connected Claude users per address. Tokens are 256-bit: the cap protects the
   * database, not the tokens.
   */
  oauthToken: { max: 600, windowS: 10 * 60, by: "ip" },
  /** Answers on the consent screen and disconnecting apps. */
  oauthConsent: { max: 30, windowS: 10 * 60, by: "wallet" },
} as const;

export type LimitRule = keyof typeof RULES;

/** The client's IP as Vercel reports it ("local" when there is none, e.g. in development). */
export function clientIp(request: Request): string {
  const header = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "";
  return header.split(",")[0].trim() || "local";
}

const ipKey = (ip: string) => {
  const secret = process.env.PIKAMD_SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`pikamd:ratelimit-ip:v1:${ip}`).digest("hex").slice(0, 32);
};

/**
 * Counts this request against the rule. Returns a 429 response when over the limit, otherwise
 * null. Without a database (local dev store) nothing is limited; a database error lets the request
 * through (the action itself would fail the same way) and is logged.
 */
export async function rateLimited(rule: LimitRule, subject: { request: Request; wallet?: string | null }): Promise<Response | null> {
  const db = supabase();
  if (!db) return null;
  const r = RULES[rule];
  const who = r.by === "ip" ? ipKey(clientIp(subject.request)) : subject.wallet?.toLowerCase();
  if (!who) return null;
  const res = await db.rpc("rate_limit", { p_key: `${rule}:${who}`, p_max: r.max, p_window_seconds: r.windowS });
  if (res.error) {
    console.error(`[ratelimit] ${rule}: ${res.error.code ?? ""} ${res.error.message}`);
    return null;
  }
  if (res.data === true) return null;
  return Response.json(
    { error: "Too many requests. Wait a few minutes and try again" },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(r.windowS) } },
  );
}
