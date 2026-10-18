// End-to-end check of wallet sign-in (SIWE) and likes / PikaGold (ARCHITECTURE K22).
// Run with the dev server up:  npm run auth:smoke   (PIKAMD_URL overrides http://localhost:3001)
// Signs in with two throwaway keys (well-known anvil accounts, never funded on Arc), likes,
// and tries the attacks the design must stop. The local store (.data/pikamd-dev.json, see
// lib/server/store.ts) is put back exactly as it was afterwards.
import { readFile, rm, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

import { createHash } from "node:crypto";
import { clearRateLimits, clearTestCollections, clearTestLikes, devDatabase, rpc } from "./smoke-guard.mjs";

// null = local dev store; otherwise the development Supabase project (never the live one)
const db = await devDatabase("auth:smoke");

const BASE = process.env.PIKAMD_URL ?? "http://localhost:3001";
const ORIGIN = new URL(BASE).origin;
const HOST = new URL(BASE).host;
const CHAIN_ID = 5042002; // Arc testnet (ARC.md §2)
// The registry's deploy transaction on Arc testnet (ARC.md §8): real, successful, no HiddenSet
const DEPLOY_TX = "0xca4f410bf9e434edc542f6c2c118695458cdc197480a64e98b1190b51e04fb55";
const STATEMENT = "Sign in to PikaMd. This is free: it doesn't send a transaction or cost gas.";
const FILE = new URL("../.data/pikamd-dev.json", import.meta.url);

const alice = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const bob = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
};

async function call(method, path, { cookie, body, origin = ORIGIN } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(new URL(path, BASE), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json: await res.json().catch(() => null), setCookie };
}

const nonce = async () => (await call("POST", "/api/auth/nonce")).json.nonce;
const siwe = (account, n, overrides = {}) =>
  createSiweMessage({
    address: account.address, chainId: CHAIN_ID, domain: HOST, uri: ORIGIN, version: "1",
    nonce: n, statement: STATEMENT, issuedAt: new Date(), ...overrides,
  });

async function signIn(account) {
  const message = siwe(account, await nonce());
  const signature = await account.signMessage({ message });
  const res = await call("POST", "/api/auth/verify", { body: { message, signature } });
  const cookie = res.setCookie?.split(";")[0] ?? null;
  return { res, cookie, message, signature };
}

const backup = await readFile(FILE, "utf8").catch(() => null);
await clearTestLikes(db, [alice.address, bob.address]);
await clearTestCollections(db, [alice.address, bob.address]);
await clearRateLimits(db);

try {
  // ── Sign-in ──
  const a = await signIn(alice);
  check(a.res.status === 200 && a.res.json?.address === alice.address, "alice signs in");
  check(/HttpOnly/i.test(a.res.setCookie ?? "") && /SameSite=Strict/i.test(a.res.setCookie ?? ""), "session cookie is HttpOnly + SameSite=Strict");
  check((await call("GET", "/api/auth/me", { cookie: a.cookie })).json?.address === alice.address, "me = alice");
  check((await call("GET", "/api/auth/me")).json?.address === null, "no cookie, no session");

  const replay = await call("POST", "/api/auth/verify", { body: { message: a.message, signature: a.signature } });
  check(replay.status === 400 && !replay.setCookie, "replaying a used signature is refused");

  const n1 = await nonce();
  const wrongSigner = siwe(alice, n1);
  const bobSig = await bob.signMessage({ message: wrongSigner });
  const forged = await call("POST", "/api/auth/verify", { body: { message: wrongSigner, signature: bobSig } });
  check(forged.status === 401 && !forged.setCookie, "bob can't sign in as alice");

  const n2 = await nonce();
  const otherChain = siwe(bob, n2, { chainId: 1 });
  const r2 = await call("POST", "/api/auth/verify", { body: { message: otherChain, signature: await bob.signMessage({ message: otherChain }) } });
  check(r2.status === 400 && !r2.setCookie, "message for another network refused");

  const n3 = await nonce();
  const otherSite = siwe(bob, n3, { domain: "evil.example", uri: "https://evil.example" });
  const r3 = await call("POST", "/api/auth/verify", { body: { message: otherSite, signature: await bob.signMessage({ message: otherSite }) } });
  check(r3.status === 400 && !r3.setCookie, "message for another site refused");

  const made = siwe(bob, "0123456789abcdef0123456789abcdef");
  const r4 = await call("POST", "/api/auth/verify", { body: { message: made, signature: await bob.signMessage({ message: made }) } });
  check(r4.status === 400 && !r4.setCookie, "nonce the server never issued refused");

  const fresh = (await call("POST", "/api/auth/nonce")).json;
  check(Math.abs(Date.parse(fresh?.issuedAt) - Date.now()) < 10_000, "nonce comes with the server's issue time");

  const xs = await call("POST", "/api/auth/nonce", { origin: "https://evil.example" });
  check(xs.status === 403, "cross-origin nonce request refused");

  const fakeCookie = "pikamd_session=eyJ2IjoxLCJhIjoiMHhmMzlGZDZlNTFhYWQ4OEY2RjRjZTZhQjg4MjcyNzljZmZGYjkyMjY2IiwiaWF0IjowLCJleHAiOjk5OTk5OTk5OTl9.AAAA";
  check((await call("GET", "/api/auth/me", { cookie: fakeCookie })).json?.address === null, "forged session cookie ignored");

  // ── Likes ──
  // react-performance's author in lib/data/mock-guidelines.ts
  const slug = "react-performance";
  const AUTHOR = "0x3e6b9d2f5a8c1e4b7d0a3f6c9e2b5d8a1f4c7e99";
  const listed = await call("GET", "/api/likes");
  const before = listed.json?.counts?.[slug];
  check(listed.status === 200 && typeof before === "number", `counts listed (${slug}: ${before})`);

  const profileBefore = await call("GET", `/api/profile/${AUTHOR}`);
  check(profileBefore.status === 200 && profileBefore.json?.guidelines >= 1, `author profile readable (${profileBefore.json?.pikagold} PikaGold, ${profileBefore.json?.guidelines} guideline)`);

  const anon = await call("PUT", `/api/likes/${slug}`);
  check(anon.status === 401, "like without signing in refused");

  const crossLike = await call("PUT", `/api/likes/${slug}`, { cookie: a.cookie, origin: "https://evil.example" });
  check(crossLike.status === 403, "like from another site refused (CSRF)");

  const like1 = await call("PUT", `/api/likes/${slug}`, { cookie: a.cookie, body: { wallet: bob.address } });
  check(like1.status === 200 && like1.json?.created === true && like1.json?.count === before + 1, "alice likes once (+1), wallet in body ignored");

  const like2 = await call("PUT", `/api/likes/${slug}`, { cookie: a.cookie });
  check(like2.status === 200 && like2.json?.created === false && like2.json?.count === before + 1, "alice's second like changes nothing");

  const mineA = (await call("GET", "/api/likes", { cookie: a.cookie })).json?.mine ?? [];
  check(mineA.includes(slug), "alice's liked list has it");

  // Unlike: the count drops, the author keeps the PikaGold, liking again earns none
  const goldNow = async () => (await call("GET", `/api/profile/${AUTHOR}`)).json?.pikagold;
  check((await goldNow()) === profileBefore.json?.pikagold + 1, "author earned 1 PikaGold for alice's like");
  check((await call("DELETE", `/api/likes/${slug}`)).status === 401, "unlike without signing in refused");
  check((await call("DELETE", `/api/likes/${slug}`, { cookie: a.cookie, origin: "https://evil.example" })).status === 403, "unlike from another site refused (CSRF)");
  const un1 = await call("DELETE", `/api/likes/${slug}`, { cookie: a.cookie });
  check(un1.status === 200 && un1.json?.removed === true && un1.json?.count === before, "alice takes her like back (-1)");
  const un2 = await call("DELETE", `/api/likes/${slug}`, { cookie: a.cookie });
  check(un2.status === 200 && un2.json?.removed === false && un2.json?.count === before, "a second unlike changes nothing");
  check(!((await call("GET", "/api/likes", { cookie: a.cookie })).json?.mine ?? []).includes(slug), "alice's liked list no longer has it");
  check((await goldNow()) === profileBefore.json?.pikagold + 1, "the author keeps the PikaGold after the unlike");
  const relike = await call("PUT", `/api/likes/${slug}`, { cookie: a.cookie });
  check(relike.status === 200 && relike.json?.created === false && relike.json?.restored === true && relike.json?.count === before + 1, "alice likes again (+1 like, restored)");
  check((await goldNow()) === profileBefore.json?.pikagold + 1, "liking again earns no second PikaGold");
  check((await call("DELETE", "/api/likes/does-not-exist", { cookie: a.cookie })).status === 404, "unlike of an unknown guideline refused");
  const mineBob = (await call("GET", "/api/likes")).json?.mine ?? [];
  check(mineBob.length === 0, "signed-out visitor has no liked list");

  const b = await signIn(bob);
  const likeB = await call("PUT", `/api/likes/${slug}`, { cookie: b.cookie });
  check(likeB.json?.created === true && likeB.json?.count === before + 2, "bob's like counts separately (+1)");

  const profileAfter = await call("GET", `/api/profile/${AUTHOR}`);
  check(profileAfter.json?.pikagold === profileBefore.json?.pikagold + 2, "author earned 1 PikaGold per like (+2)");

  const unknown = await call("PUT", "/api/likes/does-not-exist", { cookie: a.cookie });
  check(unknown.status === 404, "unknown guideline refused");

  check((await call("GET", "/api/profile/not-an-address")).status === 400, "bad profile address refused");

  // ── Shared by me (needs the database; the local dev store has no publish tables) ──
  if (db) {
    check((await call("GET", "/api/me/guidelines")).status === 401, "shared list needs a session");
    const mineA = await call("GET", "/api/me/guidelines", { cookie: a.cookie });
    check(mineA.status === 200 && Array.isArray(mineA.json?.guidelines), "alice gets her shared list");
    check((mineA.json?.guidelines ?? []).every((g) => g.author.address.toLowerCase() === alice.address.toLowerCase()), "it holds only alice's guidelines");
    const mineB2 = await call("GET", "/api/me/guidelines", { cookie: b.cookie });
    check((mineB2.json?.guidelines ?? []).every((g) => g.author.address.toLowerCase() === bob.address.toLowerCase()), "bob never sees alice's (hidden ones included)");
    check((await call("POST", "/api/guidelines/visibility", { body: { txHash: DEPLOY_TX } })).status === 401, "hide sync needs a session");
    check((await call("POST", "/api/guidelines/visibility", { cookie: a.cookie, origin: "https://evil.example", body: { txHash: DEPLOY_TX } })).status === 403, "hide sync from another site refused (CSRF)");
    check((await call("POST", "/api/guidelines/visibility", { cookie: a.cookie, body: { txHash: "0x12" } })).status === 400, "malformed transaction hash refused");
    const notHide = await call("POST", "/api/guidelines/visibility", { cookie: a.cookie, body: { txHash: DEPLOY_TX } });
    check(notHide.status === 400 && /No hide/.test(notHide.json?.error ?? ""), "a real Arc transaction without HiddenSet changes nothing");

    // ── Tip records (K21): no sign-in, but only Tipped events of our contract on Arc count ──
    check((await call("POST", "/api/tips/record", { origin: "https://evil.example", body: { txHash: DEPLOY_TX } })).status === 403, "tip record from another site refused (CSRF)");
    const text = await fetch(new URL("/api/tips/record", BASE), { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "text/plain" }, body: DEPLOY_TX });
    check(text.status === 415, "tip record must be JSON");
    const badHash = await call("POST", "/api/tips/record", { body: { txHash: "0x12" } });
    if (badHash.status === 503) {
      check(/aren't recorded/.test(badHash.json?.error ?? ""), "no tips contract on this network: the record endpoint says so (503)");
    } else {
      check(badHash.status === 400, "malformed transaction hash refused");
      const notTip = await call("POST", "/api/tips/record", { body: { txHash: DEPLOY_TX } });
      check(notTip.status === 400 && /No tip found/.test(notTip.json?.error ?? ""), "a real Arc transaction without a tip records nothing");
    }
    const tipsProfile = (await call("GET", `/api/profile/${alice.address}`)).json;
    check(tipsProfile?.tipsReceived === "0" && tipsProfile?.tipsCount === 0, "profile carries tips received (none for a test wallet)");

    // ── Collection (K12): the wallet's own list, from the session only ──
    check((await call("GET", "/api/collection")).status === 401, "collection needs a session");
    check((await call("PUT", "/api/collection/secure-solidity")).status === 401, "saving needs a session");
    check((await call("PUT", "/api/collection/secure-solidity", { cookie: a.cookie, origin: "https://evil.example" })).status === 403, "saving from another site refused (CSRF)");
    const save1 = await call("PUT", "/api/collection/secure-solidity", { cookie: a.cookie });
    check(save1.status === 200 && save1.json?.changed === true && save1.json?.total === 1, "alice saves a guideline");
    const save2 = await call("PUT", "/api/collection/react-performance", { cookie: a.cookie });
    check(save2.json?.total === 2, "alice saves a second one");
    check((await call("PUT", "/api/collection/secure-solidity", { cookie: a.cookie })).json?.changed === false, "saving again changes nothing");
    check((await call("PUT", "/api/collection/does-not-exist", { cookie: a.cookie })).status === 404, "unknown guideline can't be saved");
    check((await call("PUT", "/api/collection/Bad_Slug!", { cookie: a.cookie })).status === 404, "malformed name refused");
    const listA = await call("GET", "/api/collection", { cookie: a.cookie });
    check(JSON.stringify(listA.json?.slugs) === JSON.stringify(["react-performance", "secure-solidity"]), "alice's list, newest first");
    check((await call("GET", "/api/collection", { cookie: b.cookie })).json?.slugs?.length === 0, "bob's list is his own (empty)");
    const removed = await call("DELETE", "/api/collection/secure-solidity", { cookie: a.cookie });
    check(removed.json?.changed === true && removed.json?.total === 1, "alice removes one");
    check((await call("DELETE", "/api/collection/secure-solidity", { cookie: a.cookie })).json?.changed === false, "removing again changes nothing");

    // ── MCP key (K11): only the SHA-256 reaches the server; one active key per wallet ──
    const sha = (k) => createHash("sha256").update(k).digest("hex");
    const k1 = "pmd_" + "1a".repeat(20);
    const k2 = "pmd_" + "2b".repeat(20);
    const mask = (k) => `${k.slice(0, 8)}…${k.slice(-4)}`;
    check((await call("GET", "/api/mcp-key")).status === 401, "key needs a session");
    check((await call("POST", "/api/mcp-key", { body: { keyHash: sha(k1), masked: mask(k1) } })).status === 401, "creating a key needs a session");
    check((await call("POST", "/api/mcp-key", { cookie: a.cookie, origin: "https://evil.example", body: { keyHash: sha(k1), masked: mask(k1) } })).status === 403, "creating a key from another site refused (CSRF)");
    check((await call("POST", "/api/mcp-key", { cookie: a.cookie, body: { key: k1 } })).status === 400, "a raw key is refused: only its hash is accepted");
    check((await call("POST", "/api/mcp-key", { cookie: a.cookie, body: { keyHash: sha(k1), masked: k1 } })).status === 400, "a masked form that is the whole key is refused");
    check((await call("GET", "/api/mcp-key", { cookie: a.cookie })).json?.key === null, "no key yet");
    const made = await call("POST", "/api/mcp-key", { cookie: a.cookie, body: { keyHash: sha(k1), masked: mask(k1) } });
    check(made.status === 200 && made.json?.key?.masked === mask(k1) && made.json?.key?.lastUsedAt === null, "alice creates a key");
    const opened = await rpc(db, "mcp_key_collection", { p_hash: sha(k1) });
    check(opened[0]?.wallet === alice.address.toLowerCase() && JSON.stringify(opened[0]?.slugs) === JSON.stringify(["react-performance"]), "the key opens alice's collection");
    check((await call("POST", "/api/mcp-key", { cookie: b.cookie, body: { keyHash: sha(k1), masked: mask(k1) } })).status === 409, "bob can't register alice's key hash");
    await call("POST", "/api/mcp-key", { cookie: a.cookie, body: { keyHash: sha(k2), masked: mask(k2) } });
    check((await rpc(db, "mcp_key_collection", { p_hash: sha(k1) })).length === 0, "a new key retires the old one");
    check((await call("GET", "/api/mcp-key", { cookie: a.cookie })).json?.key?.masked === mask(k2), "the new key is the active one");
    check((await call("DELETE", "/api/mcp-key", { cookie: a.cookie, origin: "https://evil.example" })).status === 403, "revoking from another site refused (CSRF)");
    check((await call("DELETE", "/api/mcp-key", { cookie: a.cookie })).json?.revoked === true, "alice revokes it");
    check((await rpc(db, "mcp_key_collection", { p_hash: sha(k2) })).length === 0, "a revoked key opens nothing");
  }

  // ── Logout ──
  const notMine = await call("POST", "/api/auth/logout", { cookie: a.cookie, body: { address: bob.address } });
  check(notMine.json?.ended === false && !notMine.setCookie, "ending bob's session leaves alice's alone (account switch race)");
  const out = await call("POST", "/api/auth/logout", { cookie: a.cookie });
  check(out.status === 200 && /pikamd_session=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(out.setCookie ?? ""), "logout clears the cookie");
} finally {
  await clearTestLikes(db, [alice.address, bob.address]);
  await clearTestCollections(db, [alice.address, bob.address]);
  if (backup === null) await rm(FILE, { force: true });
  else await writeFile(FILE, backup);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
