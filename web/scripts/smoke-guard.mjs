// Smoke tests drive the dev server, which uses Supabase when web/.env.local sets SUPABASE_URL.
// They need the sample guidelines and write likes, whose rows the app never deletes. So:
// - local dev store (no SUPABASE_URL): run as before
// - the LIVE project: never run (it would leave test likes on the real site)
// - any other project (the development one): run, after `npm run db:seed`, and clear the test
//   wallets' likes before and after through the server key
// Reads values from .env.local but never prints secrets.
import { readFile } from "node:fs/promises";

/** The project the deployed testnet site uses. Override if it ever changes. */
export const LIVE_SUPABASE_REF = process.env.PIKAMD_LIVE_SUPABASE_REF ?? "sdjsvemkchgonznhbuku";

export async function readEnvLocal() {
  const text = await readFile(new URL("../.env.local", import.meta.url), "utf8").catch(() => "");
  return Object.fromEntries(
    text.split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

/** The development database the dev server uses, or null for the local dev store. Exits for the live one. */
export async function devDatabase(name) {
  const env = await readEnvLocal();
  if (!env.SUPABASE_URL) return null;
  const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
  if (ref === LIVE_SUPABASE_REF) {
    console.error(
      `${name}: skipped. web/.env.local points at the LIVE Supabase project (${ref}). This test writes\n` +
        `likes, so it only runs against the local dev store or the development project.`,
    );
    process.exit(2);
  }
  const db = { url: env.SUPABASE_URL, key: env.SUPABASE_SECRET_KEY, ref };
  const res = await rest(db, "GET", "/rest/v1/listed_guidelines?select=id&limit=1");
  const rows = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(rows)) {
    console.error(`${name}: can't read the development database ${ref} (HTTP ${res.status}).`);
    process.exit(2);
  }
  if (rows.length === 0) {
    console.error(`${name}: the development database ${ref} has no guidelines yet. Run: npm run db:seed`);
    process.exit(2);
  }
  return db;
}

function rest(db, method, path) {
  return fetch(db.url + path, { method, headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, Prefer: "return=minimal" } });
}

/** Resets the rate-limit counters (development database only): smoke runs sign in many times from one IP. */
export async function clearRateLimits(db) {
  if (!db) return;
  const res = await rest(db, "DELETE", "/rest/v1/rate_limits?key=neq.");
  if (!res.ok && res.status !== 404) console.error(`clearRateLimits: HTTP ${res.status}`);
}

/** Deletes the test wallets' likes (development database only; the app itself never deletes like rows). */
export async function clearTestLikes(db, wallets) {
  if (!db) return;
  const list = wallets.map((w) => w.toLowerCase()).join(",");
  const res = await rest(db, "DELETE", `/rest/v1/stars?wallet_address=in.(${list})`);
  if (!res.ok) throw new Error(`clearing test likes failed (HTTP ${res.status})`);
}

/** Calls a database function with the server key (development database only). */
export async function rpc(db, fn, args) {
  const res = await fetch(`${db.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${fn} failed (HTTP ${res.status}): ${body?.message ?? ""}`);
  return body;
}

/** Deletes the test wallets' collections, MCP keys and reports (development database only). */
export async function clearTestCollections(db, wallets) {
  if (!db) return;
  const list = wallets.map((w) => w.toLowerCase()).join(",");
  for (const table of ["collections", "mcp_keys", "reports"]) {
    const column = table === "reports" ? "reporter_address" : "wallet_address";
    const res = await rest(db, "DELETE", `/rest/v1/${table}?${column}=in.(${list})`);
    if (!res.ok) throw new Error(`clearing test ${table} failed (HTTP ${res.status})`);
  }
}

/** Deletes the test wallets' OAuth grants (their tokens go with them), codes, and the test clients' requests and registrations. */
export async function clearTestOAuth(db, wallets, clientIds) {
  if (!db) return;
  const list = wallets.map((w) => w.toLowerCase()).join(",");
  const clients = clientIds.map((c) => `"${c}"`).join(",");
  const steps = [
    `/rest/v1/oauth_codes?wallet_address=in.(${list})`,
    `/rest/v1/oauth_grants?wallet_address=in.(${list})`,
    ...(clientIds.length ? [`/rest/v1/oauth_requests?client_id=in.(${clients})`, `/rest/v1/oauth_clients?client_id=in.(${clients})`] : []),
  ];
  for (const path of steps) {
    const res = await rest(db, "DELETE", path);
    if (!res.ok) throw new Error(`clearing test OAuth rows failed (HTTP ${res.status}) at ${path.split("?")[0]}`);
  }
}
