import "server-only";
import { lookup } from "node:dns";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import {
  ACCESS_TTL_S,
  CODE_TTL_S,
  REFRESH_TTL_S,
  REQUEST_TTL_S,
  isCimdClientId,
  isNonPublicAddress,
  isSecret,
  parseCimd,
  publicOrigin,
  sha256hex,
  type ClientInfo,
} from "@/lib/oauth/core";
import { check, supabase } from "@/lib/server/supabase";

// The authorization server's storage and its one outbound call (ARCHITECTURE §8.2; tables and
// functions in web/supabase/migrations/20261025090000_oauth.sql). Only SHA-256 hashes of request
// ids, codes and tokens reach the database.

/** Hosts this site answers on, besides localhost (same list as the MCP route's Host check). */
export const ALLOWED_HOSTS = (process.env.PIKAMD_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export const originOf = (request: Request) => publicOrigin(request.url, ALLOWED_HOSTS);

const db = () => {
  const client = supabase();
  if (!client) throw new Error("OAuth needs the database");
  return client;
};

// ── Client ID Metadata Documents ────────────────────────────────────────────────────────────

const CIMD_MAX_BYTES = 5 * 1024;
const CIMD_TIMEOUT_MS = 3000;
const cimdCache = new Map<string, { client: ClientInfo; until: number }>();

/** DNS answers are checked before the socket connects, so a name can't lead to a private address. */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const list = addresses as unknown as { address: string; family: number }[];
    if (list.length === 0 || list.some((a) => isNonPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`${hostname} resolves to a non-public address`), { code: "ENOTPUBLIC" }), "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function maxAgeSeconds(cacheControl: string | undefined): number {
  const m = cacheControl?.match(/max-age=(\d+)/i);
  const seconds = m ? Number(m[1]) : 300;
  if (/no-store|no-cache/i.test(cacheControl ?? "")) return 0;
  return Math.min(Math.max(seconds, 0), 3600);
}

/** GET a CIMD over https: public addresses only, no redirects, 3 seconds, 5 KB, JSON. */
function fetchCimdDocument(url: string): Promise<{ doc: unknown; maxAge: number }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      { method: "GET", lookup: publicOnlyLookup, timeout: CIMD_TIMEOUT_MS, headers: { Accept: "application/json", "User-Agent": "PikaMd-OAuth/1" } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`client metadata answered ${res.statusCode}`));
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > CIMD_MAX_BYTES) {
            req.destroy(new Error("client metadata is too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            resolve({ doc: JSON.parse(Buffer.concat(chunks).toString("utf8")), maxAge: maxAgeSeconds(res.headers["cache-control"]) });
          } catch {
            reject(new Error("client metadata isn't JSON"));
          }
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("client metadata took too long")));
    req.on("error", reject);
    req.end();
  });
}

/** The client behind a client_id: a CIMD fetched (and cached as its headers allow), or a DCR client. */
export async function resolveClient(clientId: string): Promise<ClientInfo | { error: string }> {
  if (isCimdClientId(clientId)) {
    const cached = cimdCache.get(clientId);
    if (cached && cached.until > Date.now()) return cached.client;
    let fetched: { doc: unknown; maxAge: number };
    try {
      fetched = await fetchCimdDocument(clientId);
    } catch (error) {
      console.error(`[oauth] client metadata ${clientId}: ${(error as Error).message}`);
      return { error: "The app's client metadata couldn't be fetched" };
    }
    const client = parseCimd(clientId, fetched.doc);
    if ("error" in client) return client;
    if (fetched.maxAge > 0) {
      if (cimdCache.size > 500) cimdCache.clear();
      cimdCache.set(clientId, { client, until: Date.now() + fetched.maxAge * 1000 });
    }
    return client;
  }
  if (!isSecret("client", clientId)) return { error: "Unknown client_id" };
  const [row] = (check(await db().rpc("oauth_dcr_client", { p_client_id: clientId }), "oauth_dcr_client") ?? []) as {
    client_name: string;
    redirect_uris: string[];
  }[];
  if (!row) return { error: "Unknown client_id" };
  return { clientId, kind: "dcr", name: row.client_name, host: null, redirectUris: row.redirect_uris };
}

// ── Storage ─────────────────────────────────────────────────────────────────────────────────

export async function registerClient(clientId: string, name: string, redirectUris: string[]): Promise<void> {
  check(await db().rpc("oauth_register_client", { p_client_id: clientId, p_name: name, p_redirect_uris: redirectUris }), "oauth_register_client");
}

export type PendingRequest = {
  client: ClientInfo;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  resource: string;
  scope: string;
};

export async function createRequest(requestId: string, r: PendingRequest): Promise<void> {
  check(
    await db().rpc("oauth_create_request", {
      p_id_hash: sha256hex(requestId),
      p_client_id: r.client.clientId,
      p_client_kind: r.client.kind,
      p_client_name: r.client.name,
      p_client_host: r.client.host,
      p_redirect_uri: r.redirectUri,
      p_state: r.state,
      p_code_challenge: r.codeChallenge,
      p_resource: r.resource,
      p_scope: r.scope,
      p_ttl_seconds: REQUEST_TTL_S,
    }),
    "oauth_create_request",
  );
}

export type RequestInfo = { clientKind: "cimd" | "dcr"; clientName: string; clientHost: string | null; redirectUri: string; scope: string; expiresAt: string };

export async function requestInfo(requestId: string): Promise<RequestInfo | null> {
  if (!isSecret("request", requestId)) return null;
  const [row] = (check(await db().rpc("oauth_request_info", { p_id_hash: sha256hex(requestId) }), "oauth_request_info") ?? []) as {
    client_kind: "cimd" | "dcr";
    client_name: string;
    client_host: string | null;
    redirect_uri: string;
    scope: string;
    expires_at: string;
  }[];
  return row
    ? { clientKind: row.client_kind, clientName: row.client_name, clientHost: row.client_host, redirectUri: row.redirect_uri, scope: row.scope, expiresAt: row.expires_at }
    : null;
}

/** Answers a request: a code for the wallet (allow) or nothing (deny). Null if it was already answered or expired. */
export async function answerRequest(
  requestId: string,
  answer: { allow: true; wallet: string; code: string } | { allow: false },
): Promise<{ redirectUri: string; state: string | null } | null> {
  if (!isSecret("request", requestId)) return null;
  const res = answer.allow
    ? await db().rpc("oauth_approve", { p_id_hash: sha256hex(requestId), p_wallet: answer.wallet.toLowerCase(), p_code_hash: sha256hex(answer.code), p_code_ttl_seconds: CODE_TTL_S })
    : await db().rpc("oauth_deny", { p_id_hash: sha256hex(requestId) });
  const [row] = (check(res, answer.allow ? "oauth_approve" : "oauth_deny") ?? []) as { redirect_uri: string; state: string | null }[];
  return row ? { redirectUri: row.redirect_uri, state: row.state } : null;
}

export type TokenOutcome = { status: "ok"; scope: string } | { status: "invalid_grant" | "invalid_target" };

export async function exchangeCode(p: {
  code: string;
  clientId: string;
  redirectUri: string | null;
  verifierChallenge: string;
  resource: string | null;
  access: string;
  refresh: string;
}): Promise<TokenOutcome> {
  const [row] = check(
    await db().rpc("oauth_exchange_code", {
      p_code_hash: sha256hex(p.code),
      p_client_id: p.clientId,
      p_redirect_uri: p.redirectUri,
      p_verifier_challenge: p.verifierChallenge,
      p_resource: p.resource,
      p_access_hash: sha256hex(p.access),
      p_refresh_hash: sha256hex(p.refresh),
      p_access_ttl: ACCESS_TTL_S,
      p_refresh_ttl: REFRESH_TTL_S,
    }),
    "oauth_exchange_code",
  ) as { status: TokenOutcome["status"]; scope: string | null }[];
  return row.status === "ok" ? { status: "ok", scope: row.scope ?? "" } : { status: row.status };
}

export async function refreshTokens(p: { refresh: string; clientId: string; resource: string | null; access: string; newRefresh: string }): Promise<TokenOutcome> {
  const [row] = check(
    await db().rpc("oauth_refresh", {
      p_refresh_hash: sha256hex(p.refresh),
      p_client_id: p.clientId,
      p_resource: p.resource,
      p_access_hash: sha256hex(p.access),
      p_new_refresh_hash: sha256hex(p.newRefresh),
      p_access_ttl: ACCESS_TTL_S,
      p_refresh_ttl: REFRESH_TTL_S,
    }),
    "oauth_refresh",
  ) as { status: TokenOutcome["status"]; scope: string | null }[];
  return row.status === "ok" ? { status: "ok", scope: row.scope ?? "" } : { status: row.status };
}

export type AccessGrant = { wallet: string; clientId: string; scopes: string[]; expiresAt: number; collection: string[] };

/** The grant behind an access token for this resource, or null (unknown, expired, revoked, other resource). */
export async function accessGrant(token: string, resource: string): Promise<AccessGrant | null> {
  if (!isSecret("access", token)) return null;
  const [row] = (check(await db().rpc("oauth_access", { p_access_hash: sha256hex(token), p_resource: resource }), "oauth_access") ?? []) as {
    wallet: string;
    client_id: string;
    scope: string;
    expires_at: string;
    slugs: string[];
  }[];
  if (!row) return null;
  return {
    wallet: row.wallet,
    clientId: row.client_id,
    scopes: row.scope.split(" ").filter(Boolean),
    expiresAt: Math.floor(new Date(row.expires_at).getTime() / 1000),
    collection: row.slugs.filter((s) => typeof s === "string"),
  };
}

export async function revokeToken(token: string, clientId: string): Promise<void> {
  const kind = isSecret("refresh", token) ? "refresh" : isSecret("access", token) ? "access" : null;
  if (!kind) return; // RFC 7009 §2.2: an invalid token is answered with 200 too
  check(await db().rpc("oauth_revoke_token", { p_token_hash: sha256hex(token), p_client_id: clientId }), "oauth_revoke_token");
}

export type ConnectedApp = { id: string; kind: "cimd" | "dcr"; name: string; host: string | null; createdAt: string; lastUsedAt: string | null };

export async function connectedApps(wallet: string): Promise<ConnectedApp[]> {
  const rows = (check(await db().rpc("oauth_wallet_grants", { p_wallet: wallet.toLowerCase() }), "oauth_wallet_grants") ?? []) as {
    id: string;
    client_kind: "cimd" | "dcr";
    client_name: string;
    client_host: string | null;
    created_at: string;
    last_used_at: string | null;
  }[];
  return rows.map((r) => ({ id: r.id, kind: r.client_kind, name: r.client_name, host: r.client_host, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

export async function disconnectApp(wallet: string, grantId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(grantId)) return false;
  return check(await db().rpc("oauth_revoke_grant", { p_wallet: wallet.toLowerCase(), p_grant_id: grantId }), "oauth_revoke_grant") === true;
}
