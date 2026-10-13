// Run: npm test  (node --experimental-strip-types --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress } from "viem";
import { NONCE_TTL_MS, buildSiweMessage, checkSiweMessage, isNonce } from "./siwe.ts";
import { issueNonce, readNonce } from "./nonce.ts";
import { SESSION_TTL_S, createSessionToken, readSessionToken } from "./session.ts";

// Throwaway test key (well-known anvil account #0), never funded on Arc.
const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const NOW = new Date("2026-10-12T12:00:00.000Z");
const EXPECTED = { domain: "localhost:3001", origin: "http://localhost:3001", chainId: 5042002, now: NOW };

const message = (overrides = {}) =>
  buildSiweMessage({
    address: account.address,
    chainId: 5042002,
    domain: "localhost:3001",
    origin: "http://localhost:3001",
    nonce: "0123456789abcdef0123456789abcdef0123456789abcdef",
    issuedAt: new Date(NOW.getTime() - 10_000),
    ...overrides,
  });

const NONCE_SECRET = "test-secret-test-secret-test-secret-0123";

test("server-signed nonces: unique, well-formed, readable only by this server until they expire", () => {
  const seen = new Set(Array.from({ length: 1000 }, () => issueNonce(NONCE_SECRET, NOW, NONCE_TTL_MS).nonce));
  assert.equal(seen.size, 1000);
  for (const n of seen) assert.ok(isNonce(n));
  assert.ok(!isNonce("abc"));
  assert.ok(!isNonce("0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"));

  const { nonce, expiresAt } = issueNonce(NONCE_SECRET, NOW, NONCE_TTL_MS);
  assert.equal(expiresAt.getTime(), NOW.getTime() + NONCE_TTL_MS);
  assert.deepEqual(readNonce(nonce, NONCE_SECRET, NOW), { expiresAt });
  assert.deepEqual(readNonce(nonce, NONCE_SECRET, new Date(expiresAt.getTime() - 1000)), { expiresAt });
  assert.equal(readNonce(nonce, NONCE_SECRET, expiresAt), null, "expired at its expiry time");
  assert.equal(readNonce(nonce, NONCE_SECRET + "x", NOW), null, "another server's secret");
});

test("a forged or edited nonce is refused", () => {
  const { nonce } = issueNonce(NONCE_SECRET, NOW, NONCE_TTL_MS);
  const flip = (s, i) => s.slice(0, i) + (s[i] === "0" ? "1" : "0") + s.slice(i + 1);
  assert.equal(readNonce(flip(nonce, 0), NONCE_SECRET, NOW), null, "random part changed");
  assert.equal(readNonce(flip(nonce, 20), NONCE_SECRET, NOW), null, "expiry extended");
  assert.equal(readNonce(flip(nonce, 47), NONCE_SECRET, NOW), null, "MAC changed");
  assert.equal(readNonce("0123456789abcdef0123456789abcdef0123456789abcdef", NONCE_SECRET, NOW), null, "made up");
  assert.equal(readNonce(nonce.toUpperCase(), NONCE_SECRET, NOW), null);
  assert.equal(readNonce(nonce.slice(0, 32), NONCE_SECRET, NOW), null, "old 32-hex format");
  assert.throws(() => readNonce(nonce, "short", NOW), /PIKAMD_SESSION_SECRET/);
});

test("a message built by the site passes, and the signature recovers the signer", async () => {
  const msg = message();
  const result = checkSiweMessage(msg, EXPECTED);
  assert.deepEqual(result, { address: account.address, nonce: "0123456789abcdef0123456789abcdef0123456789abcdef" });
  const signature = await account.signMessage({ message: msg });
  assert.equal(await recoverMessageAddress({ message: msg, signature }), account.address);
});

test("messages for another site, network or URI are refused", () => {
  assert.ok("error" in checkSiweMessage(message({ domain: "evil.example" }), EXPECTED));
  assert.ok("error" in checkSiweMessage(message({ origin: "https://evil.example" }), EXPECTED));
  assert.ok("error" in checkSiweMessage(message({ chainId: 1 }), EXPECTED));
  assert.ok("error" in checkSiweMessage(message({ chainId: 5042 }), EXPECTED));
});

test("stale, future and expired messages are refused", () => {
  const old = new Date(NOW.getTime() - NONCE_TTL_MS - 2 * 60_000);
  assert.ok("error" in checkSiweMessage(message({ issuedAt: old }), EXPECTED));
  const future = new Date(NOW.getTime() + 5 * 60_000);
  assert.ok("error" in checkSiweMessage(message({ issuedAt: future }), EXPECTED));
  const expired = new Date(NOW.getTime() - 1000);
  assert.ok("error" in checkSiweMessage(message({ expirationTime: expired }), EXPECTED));
  const notYet = new Date(NOW.getTime() + 10 * 60_000);
  assert.ok("error" in checkSiweMessage(message({ notBefore: notYet }), EXPECTED));
});

test("tampered or non-canonical text is refused", () => {
  const msg = message();
  assert.ok("error" in checkSiweMessage(msg.replace("Sign in to PikaMd.", "Sign in to Pika."), EXPECTED));
  assert.ok("error" in checkSiweMessage(`${msg}\nResources:\n- https://evil.example`, EXPECTED));
  assert.ok("error" in checkSiweMessage(`${msg}\n\nextra`, EXPECTED));
  assert.ok("error" in checkSiweMessage(`https://${msg}`, EXPECTED)); // scheme prefix
  assert.ok("error" in checkSiweMessage(msg.replace("Nonce: 0123", "Nonce: zz23"), EXPECTED));
  assert.ok("error" in checkSiweMessage("", EXPECTED));
  assert.ok("error" in checkSiweMessage("x".repeat(3000), EXPECTED));
});

const SECRET = "a".repeat(32) + "-test-secret";

test("a session token reads back the checksummed address until it expires", () => {
  const token = createSessionToken(account.address.toLowerCase(), SECRET, NOW);
  assert.equal(readSessionToken(token, SECRET, NOW), account.address);
  const almost = new Date(NOW.getTime() + (SESSION_TTL_S - 1) * 1000);
  assert.equal(readSessionToken(token, SECRET, almost), account.address);
  const after = new Date(NOW.getTime() + SESSION_TTL_S * 1000);
  assert.equal(readSessionToken(token, SECRET, after), null);
});

test("forged, altered or foreign session tokens are refused", () => {
  const token = createSessionToken(account.address, SECRET, NOW);
  const [body, mac] = token.split(".");
  // Same signature, payload swapped for another wallet
  const other = Buffer.from(JSON.stringify({ v: 1, a: "0x0000000000000000000000000000000000000001", iat: 0, exp: 9e9 })).toString("base64url");
  assert.equal(readSessionToken(`${other}.${mac}`, SECRET, NOW), null);
  // One character flipped, guaranteed different from the original
  const flipped = (mac[0] === "A" ? "B" : "A") + mac.slice(1);
  assert.equal(readSessionToken(`${body}.${flipped}`, SECRET, NOW), null);
  // A different spelling of the same bytes (unused trailing bits set) is refused too
  const last = mac.at(-1);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const twin = mac.slice(0, -1) + alphabet[alphabet.indexOf(last) ^ 1];
  assert.deepEqual(Buffer.from(twin, "base64url"), Buffer.from(mac, "base64url"));
  assert.equal(readSessionToken(`${body}.${twin}`, SECRET, NOW), null);
  assert.equal(readSessionToken(token, "b".repeat(40), NOW), null);
  assert.equal(readSessionToken(undefined, SECRET, NOW), null);
  assert.equal(readSessionToken("garbage", SECRET, NOW), null);
  assert.equal(readSessionToken(`${body}.${mac}.x`, SECRET, NOW), null);
});

test("a short or missing session secret is a hard error", () => {
  assert.throws(() => createSessionToken(account.address, "short", NOW));
  assert.throws(() => readSessionToken("x.y", undefined, NOW));
});
