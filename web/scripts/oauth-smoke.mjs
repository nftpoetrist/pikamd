// End-to-end check of OAuth sign-in for agents (ARCHITECTURE §8.2).
// Run with the dev server up:  npm run oauth:smoke   (PIKAMD_URL overrides http://localhost:3001)
//
// The client side is the official MCP SDK's own OAuth client (@modelcontextprotocol/client), not
// code written for this test: it discovers the metadata from the 401, registers, runs PKCE, checks
// iss (RFC 9207) and refreshes. It connects twice: as Claude Code, with Claude Code's real Client
// ID Metadata Document (https://claude.ai/oauth/claude-code-client-metadata, which the server
// fetches), and as a dynamically registered client. The person on the consent screen is a
// throwaway wallet (a well-known anvil key, never funded) that signs in with SIWE. Then the
// attacks: wrong verifier, code replay, refresh replay, another client, another resource, open
// redirects, SSRF through a client_id, consent without a session or from another site.
// Runs only against the development database; its rows are deleted before and after.
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from "@modelcontextprotocol/client";
import { createHash, randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { clearRateLimits, clearTestCollections, clearTestOAuth, devDatabase } from "./smoke-guard.mjs";

const db = await devDatabase("oauth:smoke");
if (!db) {
  console.error("oauth:smoke needs the development database (OAuth isn't in the local dev store).");
  process.exit(2);
}

const BASE = process.env.PIKAMD_URL ?? "http://localhost:3001";
const ORIGIN = new URL(BASE).origin;
const MCP = `${ORIGIN}/mcp`;
const CLAUDE_CODE = "https://claude.ai/oauth/claude-code-client-metadata";
const CALLBACK = "http://127.0.0.1:43117/callback"; // nothing listens: the test reads the redirect itself
// anvil account #2: public test key, never funded on Arc
const carol = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const dave = privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"); // anvil #3

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
};

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────

async function call(method, path, { cookie, body, origin = ORIGIN, form, headers: extra = {} } = {}) {
  const headers = { ...extra };
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(new URL(path, BASE), { method, headers, body: payload, redirect: "manual" });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
}

async function signIn(account) {
  const { nonce, issuedAt } = (await call("POST", "/api/auth/nonce")).json;
  const message = createSiweMessage({
    address: account.address, chainId: 5042002, domain: new URL(BASE).host, uri: ORIGIN, version: "1", nonce,
    statement: "Sign in to PikaMd. This is free: it doesn't send a transaction or cost gas.", issuedAt: new Date(issuedAt),
  });
  const res = await call("POST", "/api/auth/verify", { body: { message, signature: await account.signMessage({ message }) } });
  return res.status === 200 ? null : res.status;
}

async function cookieFor(account) {
  const { nonce, issuedAt } = (await call("POST", "/api/auth/nonce")).json;
  const message = createSiweMessage({
    address: account.address, chainId: 5042002, domain: new URL(BASE).host, uri: ORIGIN, version: "1", nonce,
    statement: "Sign in to PikaMd. This is free: it doesn't send a transaction or cost gas.", issuedAt: new Date(issuedAt),
  });
  const res = await fetch(new URL("/api/auth/verify", BASE), {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature: await account.signMessage({ message }) }),
  });
  return res.headers.get("set-cookie")?.split(";")[0] ?? null;
}

const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

/** An authorization request by hand; returns where the server sends the browser. */
async function authorize(params) {
  const res = await call("GET", `/oauth/authorize?${new URLSearchParams(params)}`);
  return res.headers.get("location") ? new URL(res.headers.get("location"), BASE) : null;
}

/** The consent step as the browser page does it: same-site POST with the session cookie. */
async function consent(location, cookie, allow = true, origin = ORIGIN) {
  const request = location.searchParams.get("request");
  return call("POST", "/api/oauth/consent", { cookie, body: { request, allow }, origin });
}

async function mcpTool(token, name, args = {}) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const text = await res.text();
  return { status: res.status, www: res.headers.get("www-authenticate"), text };
}

/** An OAuthClientProvider for the SDK, kept in memory. */
function provider({ cimd }) {
  const store = { tokens: undefined, client: undefined, verifier: undefined, authUrl: undefined, state: undefined, discovery: undefined };
  return {
    store,
    get redirectUrl() { return CALLBACK; },
    clientMetadataUrl: cimd ? CLAUDE_CODE : undefined,
    get clientMetadata() {
      return { client_name: "PikaMd smoke test", redirect_uris: [CALLBACK], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
    },
    state() { return (store.state = randomBytes(16).toString("hex")); },
    clientInformation() { return store.client; },
    saveClientInformation(info) { store.client = info; },
    tokens() { return store.tokens; },
    saveTokens(t) { store.tokens = t; },
    redirectToAuthorization(url) { store.authUrl = new URL(url); },
    saveCodeVerifier(v) { store.verifier = v; },
    codeVerifier() { return store.verifier; },
    // SEP-2352: the SDK binds the callback to the authorization server it discovered
    saveDiscoveryState(d) { store.discovery = d; },
    discoveryState() { return store.discovery; },
  };
}

/** Connect with the SDK, hit my_collection, sign in when it asks, and come back. */
async function connectWithSdk(label, cimd, cookie) {
  const p = provider({ cimd });
  const open = async () => {
    const client = new Client({ name: "pikamd-oauth-smoke", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(MCP), { authProvider: p });
    await client.connect(transport);
    return { client, transport };
  };
  let { client, transport } = await open();
  check(true, `${label}: connects and initializes without signing in`);
  const search = await client.callTool({ name: "search_guidelines", arguments: { query: "react" } });
  check(!search.isError, `${label}: search_guidelines works before sign-in`);

  let asked = false;
  try {
    await client.callTool({ name: "my_collection", arguments: {} });
  } catch (e) {
    asked = e instanceof UnauthorizedError || p.store.authUrl !== undefined;
  }
  check(asked && p.store.authUrl, `${label}: my_collection asks for sign-in (401 → authorization URL)`);
  const auth = p.store.authUrl;
  check(auth?.origin === ORIGIN && auth.pathname === "/oauth/authorize", `${label}: the SDK found /oauth/authorize through discovery`);
  check(auth?.searchParams.get("code_challenge_method") === "S256" && auth.searchParams.get("resource") === MCP, `${label}: PKCE S256 and resource=${MCP}`);
  check(auth?.searchParams.get("client_id") === (cimd ? CLAUDE_CODE : p.store.client?.client_id), `${label}: client_id is ${cimd ? "the CIMD URL" : "the registered id"}`);
  if (!cimd) check(/^pmdc_/.test(p.store.client?.client_id ?? "") && !p.store.client?.client_secret, `${label}: dynamic registration gave a public client (no secret)`);

  const location = await authorize(Object.fromEntries(auth.searchParams));
  check(location?.pathname === "/oauth/consent" && location.searchParams.has("request"), `${label}: authorize parks the request for the consent screen`);
  const info = await call("GET", `/api/oauth/consent?request=${location.searchParams.get("request")}`);
  check(info.status === 200 && (cimd ? info.json.clientHost === "claude.ai" && info.json.clientName === "Claude Code" : info.json.clientKind === "dcr"),
    `${label}: consent screen names ${cimd ? "claude.ai (verified host)" : "an unverified app"}`);
  const approved = await consent(location, cookie);
  const back = new URL(approved.json?.redirect ?? "http://x/");
  check(approved.status === 200 && back.origin === "http://127.0.0.1:43117" && back.pathname === "/callback" && /^pmdac_/.test(back.searchParams.get("code") ?? ""),
    `${label}: Allow sends the browser back to the client's callback with a code`);
  check(back.searchParams.get("state") === p.store.state && back.searchParams.get("iss") === ORIGIN, `${label}: state echoed, iss = issuer (RFC 9207)`);

  await transport.finishAuth(back.searchParams);
  check(/^pmdat_/.test(p.store.tokens?.access_token ?? "") && /^pmdrt_/.test(p.store.tokens?.refresh_token ?? ""), `${label}: the SDK redeemed the code for an access and a refresh token`);
  check(p.store.tokens?.scope === "collection:read" && p.store.tokens?.expires_in === 3600, `${label}: scope collection:read, expires in an hour`);
  await client.close();
  ({ client, transport } = await open());
  const mine = await client.callTool({ name: "my_collection", arguments: {} });
  return { p, client, mine };
}

// ── Run ─────────────────────────────────────────────────────────────────────────────────────

const registered = [];
await clearRateLimits(db);
await clearTestCollections(db, [carol.address, dave.address]);
await clearTestOAuth(db, [carol.address, dave.address], [CLAUDE_CODE]);

try {
  const carolCookie = await cookieFor(carol);
  const daveCookie = await cookieFor(dave);
  check(!!carolCookie && !!daveCookie, "test wallets sign in (SIWE)");
  const lib = (await call("GET", "/api/guidelines")).json?.guidelines ?? [];
  const slug = lib[0]?.slug;
  check(!!slug, "the library has a guideline to save");
  check((await call("PUT", `/api/collection/${slug}`, { cookie: carolCookie })).status === 200, `carol saves ${slug}`);

  // ── Discovery ──
  const prm = await call("GET", "/.well-known/oauth-protected-resource/mcp", { origin: null });
  const asm = await call("GET", "/.well-known/oauth-authorization-server", { origin: null });
  check(prm.json?.resource === MCP && prm.json.authorization_servers?.[0] === ORIGIN, "protected resource metadata: resource = /mcp, issuer listed first");
  check(asm.json?.issuer === ORIGIN && asm.json.client_id_metadata_document_supported === true && asm.json.token_endpoint_auth_methods_supported?.includes("none"),
    "authorization server metadata: issuer echoes, CIMD advertised with public clients");
  const anon = await mcpTool(null, "my_collection");
  check(anon.status === 401 && anon.www?.includes(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`) && anon.www.includes('scope="collection:read"'),
    "anonymous my_collection → 401 with resource_metadata and scope");

  // ── The real flows ──
  const cc = await connectWithSdk("Claude Code (CIMD)", true, carolCookie);
  check(!cc.mine.isError && cc.mine.content[0].text.includes(slug), "Claude Code: my_collection returns carol's collection");
  const dcr = await connectWithSdk("Dynamic client (DCR)", false, daveCookie);
  registered.push(dcr.p.store.client.client_id);
  check(!dcr.mine.isError && !dcr.mine.content[0].text.includes(slug), "DCR client: my_collection returns dave's (empty) collection, not carol's");

  const apps = await call("GET", "/api/oauth/apps", { cookie: carolCookie });
  check(apps.json?.apps?.length === 1 && apps.json.apps[0].host === "claude.ai", "carol's connected apps: claude.ai");
  check((await call("GET", "/api/oauth/apps")).status === 401, "connected apps need the session");

  // ── Refresh rotation and replay ──
  const t0 = cc.p.store.tokens;
  const refresh = (rt, client_id = CLAUDE_CODE, extra = {}) =>
    call("POST", "/oauth/token", { origin: null, form: { grant_type: "refresh_token", refresh_token: rt, client_id, ...extra } });
  const r1 = await refresh(t0.refresh_token);
  check(r1.status === 200 && r1.json.refresh_token !== t0.refresh_token && r1.headers.get("cache-control") === "no-store", "refresh rotates the refresh token (no-store)");
  check((await mcpTool(r1.json.access_token, "my_collection")).status === 200, "the new access token works");
  check((await refresh(t0.refresh_token)).json?.error === "invalid_grant", "the spent refresh token is refused");
  check((await mcpTool(r1.json.access_token, "my_collection")).status === 200, "…within the 30 s grace the connection stays up");
  check((await refresh(r1.json.refresh_token, "pmdc_" + "x".repeat(43))).json?.error === "invalid_grant", "another client can't use the refresh token");
  check((await refresh(r1.json.refresh_token, CLAUDE_CODE, { resource: "https://evil.example/mcp" })).json?.error === "invalid_target", "refresh for another resource → invalid_target");
  const r2 = await refresh(r1.json.refresh_token);
  check(r2.status === 200, "refresh again with the newest token");

  // ── Authorization code attacks (by hand) ──
  const { verifier, challenge } = pkce();
  const base = { response_type: "code", client_id: CLAUDE_CODE, redirect_uri: CALLBACK, code_challenge: challenge, code_challenge_method: "S256", state: "s1", resource: MCP };
  const loc = await authorize(base);
  const code = new URL((await consent(loc, carolCookie)).json.redirect).searchParams.get("code");
  const exchange = (extra) => call("POST", "/oauth/token", { origin: null, form: { grant_type: "authorization_code", code, client_id: CLAUDE_CODE, redirect_uri: CALLBACK, code_verifier: verifier, resource: MCP, ...extra } });
  check((await exchange({ code_verifier: pkce().verifier })).json?.error === "invalid_grant", "wrong code_verifier → invalid_grant");
  check((await exchange({ client_id: registered[0] })).json?.error === "invalid_grant", "another client's code → invalid_grant");
  check((await exchange({ redirect_uri: "http://127.0.0.1:1/callback" })).json?.error === "invalid_grant", "another redirect_uri → invalid_grant");
  check((await exchange({ resource: "https://evil.example/mcp" })).json?.error === "invalid_target", "another resource → invalid_target");
  check((await exchange({ client_secret: "x" })).status === 401, "a client secret is refused (public clients only)");
  const jsonBody = await call("POST", "/oauth/token", { origin: null, body: { grant_type: "authorization_code", code } });
  check(jsonBody.json?.error === "invalid_request", "a JSON token request is refused (form-encoded only)");
  const good = await exchange({});
  check(good.status === 200 && good.json.token_type === "Bearer", "the right verifier redeems the code (failed tries didn't burn it)");
  check((await exchange({})).json?.error === "invalid_grant", "the code works once");
  check((await mcpTool(good.json.access_token, "my_collection")).status === 401, "replaying the code revokes the tokens it gave");

  // ── Authorization request checks ──
  const page = (l) => (l?.pathname === "/oauth/consent" ? l.searchParams.get("error") : null);
  check(page(await authorize({ ...base, client_id: "pmdc_" + "y".repeat(43) })) === "invalid_client", "unknown client → PikaMd's own error page, no redirect");
  check(page(await authorize({ ...base, redirect_uri: "https://evil.example/callback" })) === "invalid_redirect_uri", "unregistered redirect_uri → own error page (no open redirect)");
  check(page(await authorize({ ...base, client_id: "https://localtest.me/client.json" })) === "invalid_client", "client_id resolving to 127.0.0.1 is never fetched (SSRF)");
  check(page(await authorize({ ...base, client_id: "https://127.0.0.1/client.json" })) === "invalid_client", "client_id on an IP address is refused");
  const dup = await call("GET", `/oauth/authorize?${new URLSearchParams(base)}&state=again`);
  check(page(new URL(dup.headers.get("location"), BASE)) === "invalid_request", "a repeated parameter → own error page");
  const toClient = async (over) => {
    const l = await authorize({ ...base, ...over });
    return l?.origin === "http://127.0.0.1:43117" ? l.searchParams : null;
  };
  let e = await toClient({ code_challenge_method: "plain", code_challenge: verifier });
  check(e?.get("error") === "invalid_request" && e.get("state") === "s1" && e.get("iss") === ORIGIN, "PKCE plain → invalid_request back to the client, with state and iss");
  e = await toClient({ code_challenge: undefined, code_challenge_method: undefined });
  check(e?.get("error") === "invalid_request", "no PKCE → invalid_request");
  e = await toClient({ response_type: "token" });
  check(e?.get("error") === "unsupported_response_type", "implicit flow → unsupported_response_type");
  e = await toClient({ resource: "https://evil.example/mcp" });
  check(e?.get("error") === "invalid_target", "another resource → invalid_target");

  // ── Consent screen checks ──
  const pending = await authorize(base);
  check((await consent(pending, null)).status === 401, "Allow without a session → 401");
  check((await consent(pending, carolCookie, true, "https://evil.example")).status === 403, "Allow from another site → 403 (CSRF)");
  const denied = await consent(pending, null, false);
  check(new URL(denied.json?.redirect ?? "http://x/").searchParams.get("error") === "access_denied", "Cancel → access_denied back to the client");
  check((await consent(pending, carolCookie)).status === 404, "an answered request can't be answered again");
  check((await call("GET", "/api/oauth/consent?request=pmdar_" + "z".repeat(43))).status === 404, "an unknown request id → 404");

  // ── Dynamic registration checks ──
  const reg = (body) => call("POST", "/oauth/register", { origin: null, body });
  check((await reg({ client_name: "x", redirect_uris: ["cursor://anysphere.cursor-mcp/oauth/callback"] })).json?.error === "invalid_redirect_uri", "custom-scheme redirect refused (MCP: https or localhost)");
  check((await reg({ client_name: "x", redirect_uris: ["http://evil.example/cb"] })).json?.error === "invalid_redirect_uri", "plain http to a public host refused");
  check((await call("POST", "/oauth/register", { origin: null, form: { client_name: "x" } })).json?.error === "invalid_client_metadata", "registration needs JSON");

  // ── Revocation and disconnecting ──
  const t2 = r2.json;
  check((await call("POST", "/oauth/revoke", { origin: null, form: { token: t2.access_token, client_id: registered[0] } })).status === 200, "revoke with another client_id answers 200…");
  check((await mcpTool(t2.access_token, "my_collection")).status === 200, "…and changes nothing");
  check((await call("POST", "/oauth/revoke", { origin: null, form: { token: t2.refresh_token, client_id: CLAUDE_CODE } })).status === 200, "the client revokes its refresh token");
  check((await mcpTool(t2.access_token, "my_collection")).status === 401, "…which ends the whole connection");
  const daveTokens = dcr.p.store.tokens;
  const daveApps = (await call("GET", "/api/oauth/apps", { cookie: daveCookie })).json.apps;
  check((await call("DELETE", `/api/oauth/apps/${daveApps[0].id}`, { cookie: carolCookie })).json?.disconnected === false, "carol can't disconnect dave's app");
  check((await call("DELETE", `/api/oauth/apps/${daveApps[0].id}`, { cookie: daveCookie, origin: "https://evil.example" })).status === 403, "disconnect from another site → 403");
  check((await call("DELETE", `/api/oauth/apps/${daveApps[0].id}`, { cookie: daveCookie })).json?.disconnected === true, "dave disconnects his app");
  const after = await mcpTool(daveTokens.access_token, "my_collection");
  check(after.status === 401 && after.www?.includes('error="invalid_token"'), "its token stops working at once (401 invalid_token)");
  check((await mcpTool(daveTokens.access_token, "search_guidelines", { query: "react" })).status === 401, "a dead token isn't silently treated as anonymous");
  check((await mcpTool(null, "search_guidelines", { query: "react" })).status === 200, "without a token, public tools still work");
  // A chunked body over 64 KB with no Content-Length: refused without the server buffering it all
  const big = new ReadableStream({
    start(c) {
      const chunk = new TextEncoder().encode("x".repeat(16 * 1024));
      for (let i = 0; i < 64; i++) c.enqueue(chunk); // 1 MiB
      c.close();
    },
  });
  // (the server may answer 413 and close before the upload ends, which fetch reports as a failure:
  // what matters is that it's refused quickly instead of holding the function)
  const started = Date.now();
  const chunked = await fetch(MCP, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: big, duplex: "half" }).catch(() => ({ status: "closed" }));
  const took = Date.now() - started;
  check((chunked.status === 413 || chunked.status === "closed") && took < 5000, `a 1 MiB chunked body is refused at once (${chunked.status}, ${took} ms)`);
  // A body that stops arriving: cut off after the read timeout, not held open
  const slow = new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode('{"jsonrpc":"2.0",')); await new Promise((r) => setTimeout(r, 15000)); c.close(); } });
  const t1 = Date.now();
  const stalled = await fetch(MCP, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: slow, duplex: "half" }).catch(() => ({ status: "closed" }));
  const waited = Date.now() - t1;
  check((stalled.status === 408 || stalled.status === "closed") && waited < 13000, `a stalled body is cut off after ~10 s (${stalled.status}, ${waited} ms)`);
  check((await mcpTool(null, "search_guidelines", { query: "react" })).status === 200, "…and the server keeps answering");
  check((await signIn(carol)) === null, "sign-in still works after all of this");
} finally {
  await clearTestOAuth(db, [carol.address, dave.address], [CLAUDE_CODE, ...registered]);
  await clearTestCollections(db, [carol.address, dave.address]);
  await clearRateLimits(db);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll OAuth checks passed");
process.exit(failures ? 1 : 0);
