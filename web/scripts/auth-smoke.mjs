// End-to-end check of wallet sign-in (SIWE) and likes / PikaGold (ARCHITECTURE K22).
// Run with the dev server up:  npm run auth:smoke   (PIKAMD_URL overrides http://localhost:3001)
// Signs in with two throwaway keys (well-known anvil accounts, never funded on Arc), likes,
// and tries the attacks the design must stop. The local store (.data/pikamd-dev.json, see
// lib/server/store.ts) is put back exactly as it was afterwards.
import { readFile, rm, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const BASE = process.env.PIKAMD_URL ?? "http://localhost:3001";
const ORIGIN = new URL(BASE).origin;
const HOST = new URL(BASE).host;
const CHAIN_ID = 5042002; // Arc testnet (ARC.md §2)
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

  const del = await call("DELETE", `/api/likes/${slug}`, { cookie: a.cookie });
  check(del.status === 405, "likes can't be removed (no DELETE)");

  const mineA = (await call("GET", "/api/likes", { cookie: a.cookie })).json?.mine ?? [];
  check(mineA.includes(slug), "alice's liked list has it");
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

  // ── Logout ──
  const notMine = await call("POST", "/api/auth/logout", { cookie: a.cookie, body: { address: bob.address } });
  check(notMine.json?.ended === false && !notMine.setCookie, "ending bob's session leaves alice's alone (account switch race)");
  const out = await call("POST", "/api/auth/logout", { cookie: a.cookie });
  check(out.status === 200 && /pikamd_session=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(out.setCookie ?? ""), "logout clears the cookie");
} finally {
  if (backup === null) await rm(FILE, { force: true });
  else await writeFile(FILE, backup);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
