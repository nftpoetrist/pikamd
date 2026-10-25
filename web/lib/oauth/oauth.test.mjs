// Run: npm test  (node --experimental-strip-types --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SCOPE,
  authorizationRedirect,
  authorizationServerMetadata,
  bearerChallenge,
  grantedScope,
  isAllowedRedirectUri,
  isCimdClientId,
  isNonPublicAddress,
  isSecret,
  isState,
  newSecret,
  parseCimd,
  parseRegistration,
  pkceMatches,
  protectedResourceMetadata,
  publicOrigin,
  redirectMatches,
  resourceFor,
  s256,
  sameResource,
  sha256hex,
} from "./core.ts";

const ORIGIN = "https://pikamd.vercel.app";

test("secrets: 256 random bits behind their prefix, never repeated, recognized only in their own kind", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const s = newSecret("access");
    assert.ok(isSecret("access", s));
    assert.ok(!isSecret("refresh", s));
    assert.ok(!seen.has(s));
    seen.add(s);
  }
  assert.ok(isSecret("refresh", newSecret("refresh")));
  assert.ok(!isSecret("access", "pmdat_short"));
  assert.ok(!isSecret("access", "pmd_" + "a".repeat(40)), "an MCP key isn't an access token");
  assert.equal(sha256hex("x"), createHash("sha256").update("x").digest("hex"));
});

test("PKCE: the RFC 7636 appendix B example verifies; anything else doesn't", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  assert.equal(s256(verifier), challenge);
  assert.ok(pkceMatches(verifier, challenge));
  assert.ok(!pkceMatches(verifier.slice(0, -1) + "l", challenge));
  assert.ok(!pkceMatches("short", challenge), "verifier under 43 characters");
  assert.ok(!pkceMatches(verifier + "!", challenge), "verifier outside the unreserved set");
  assert.ok(!pkceMatches(verifier, verifier), "plain method (challenge = verifier) never passes");
});

test("public origin: only our hosts over https, localhost over http for development", () => {
  const hosts = ["pikamd.vercel.app"];
  assert.equal(publicOrigin("https://pikamd.vercel.app/oauth/authorize?x=1", hosts), ORIGIN);
  assert.equal(publicOrigin("http://localhost:3001/mcp", hosts), "http://localhost:3001");
  assert.equal(publicOrigin("http://pikamd.vercel.app/mcp", hosts), null, "our host over plain http");
  assert.equal(publicOrigin("https://evil.example/mcp", hosts), null);
  assert.equal(publicOrigin("https://pikamd.vercel.app.evil.example/mcp", hosts), null);
  assert.equal(publicOrigin("not a url", hosts), null);
});

test("resource: matches our /mcp ignoring case of scheme and host and one trailing slash only", () => {
  const canonical = resourceFor(ORIGIN);
  assert.equal(canonical, "https://pikamd.vercel.app/mcp");
  assert.ok(sameResource("https://pikamd.vercel.app/mcp", canonical));
  assert.ok(sameResource("HTTPS://PikaMd.Vercel.App/mcp/", canonical));
  for (const bad of [
    "https://pikamd.vercel.app",
    "https://pikamd.vercel.app/MCP",
    "https://pikamd.vercel.app/mcp?x=1",
    "https://pikamd.vercel.app/mcp#a",
    "http://pikamd.vercel.app/mcp",
    "https://other.example/mcp",
    "https://user@pikamd.vercel.app/mcp",
    "pikamd.vercel.app/mcp",
  ]) {
    assert.ok(!sameResource(bad, canonical), bad);
  }
});

test("redirect URIs: https or http on a loopback host only", () => {
  for (const ok of ["https://claude.ai/api/mcp/auth_callback", "http://localhost/callback", "http://127.0.0.1:33418/", "http://[::1]:8080/cb"]) {
    assert.ok(isAllowedRedirectUri(ok), ok);
  }
  for (const bad of [
    "cursor://anysphere.cursor-mcp/oauth/callback",
    "http://example.com/cb",
    "https://example.com/cb#frag",
    "https://user:pw@example.com/cb",
    "https://192.168.1.1/cb",
    "https://localhost/cb",
    "javascript:alert(1)",
    "data:text/html,x",
    "https://" + "a".repeat(2000) + ".com/",
    "",
    42,
  ]) {
    assert.ok(!isAllowedRedirectUri(bad), String(bad));
  }
});

test("redirect matching: exact, except the port of a registered loopback URI", () => {
  const claudeCode = ["http://localhost/callback", "http://127.0.0.1/callback"];
  assert.ok(redirectMatches("http://localhost:3118/callback", claudeCode));
  assert.ok(redirectMatches("http://127.0.0.1:50000/callback", claudeCode));
  assert.ok(redirectMatches("http://localhost/callback", claudeCode));
  assert.ok(!redirectMatches("http://localhost:3118/callback/", claudeCode), "path differs");
  assert.ok(!redirectMatches("http://localhost:3118/callback?x=1", claudeCode), "query differs");
  assert.ok(!redirectMatches("http://[::1]:3118/callback", claudeCode), "a host it didn't register");
  assert.ok(!redirectMatches("https://localhost/callback", claudeCode));
  const web = ["https://claude.ai/api/mcp/auth_callback"];
  assert.ok(redirectMatches("https://claude.ai/api/mcp/auth_callback", web));
  for (const bad of [
    "https://claude.ai/api/mcp/auth_callback/",
    "https://claude.ai/api/mcp/auth_callback?next=https://evil.example",
    "https://claude.ai:444/api/mcp/auth_callback",
    "https://evil.example/api/mcp/auth_callback",
    "https://claude.ai.evil.example/api/mcp/auth_callback",
    "HTTPS://claude.ai/api/mcp/auth_callback",
  ]) {
    assert.ok(!redirectMatches(bad, web), bad);
  }
  assert.ok(!redirectMatches("https://claude.ai/api/mcp/auth_callback", ["https://claude.ai/api/mcp/auth_callback#x"]));
});

test("CIMD client_id: https URL with a path on a public host name", () => {
  assert.ok(isCimdClientId("https://claude.ai/oauth/claude-code-client-metadata"));
  for (const bad of [
    "http://claude.ai/oauth/x",
    "https://claude.ai/",
    "https://claude.ai",
    "https://localhost/oauth/x",
    "https://127.0.0.1/x",
    "https://[::1]/x",
    "https://10.0.0.1/x",
    "https://intranet/x",
    "https://a.localhost/x",
    "https://claude.ai/oauth/../x",
    "https://claude.ai/x#frag",
    "https://u@claude.ai/x",
    "https://CLAUDE.ai/x",
    "pmdc_" + "a".repeat(43),
  ]) {
    assert.ok(!isCimdClientId(bad), bad);
  }
});

test("CIMD document: Claude Code's real document is accepted; mismatches are refused", () => {
  const url = "https://claude.ai/oauth/claude-code-client-metadata";
  // Fetched from the URL above on 2026-10-25
  const doc = {
    client_id: url,
    client_name: "Claude Code",
    client_uri: "https://claude.ai",
    redirect_uris: ["http://localhost/callback", "http://127.0.0.1/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
  const c = parseCimd(url, doc);
  assert.ok(!("error" in c));
  assert.equal(c.host, "claude.ai");
  assert.equal(c.kind, "cimd");
  assert.ok("error" in parseCimd(url, { ...doc, client_id: url + "x" }), "client_id must equal the URL");
  assert.ok("error" in parseCimd(url, { ...doc, client_name: "" }));
  assert.ok("error" in parseCimd(url, { ...doc, redirect_uris: ["cursor://x/cb"] }));
  assert.ok("error" in parseCimd(url, { ...doc, redirect_uris: [] }));
  assert.ok("error" in parseCimd(url, { ...doc, token_endpoint_auth_method: "private_key_jwt" }));
  assert.ok("error" in parseCimd(url, { ...doc, grant_types: ["client_credentials"] }));
  assert.ok("error" in parseCimd(url, [doc]));
  assert.equal(parseCimd(url, { ...doc, client_name: "Evil\u0000\nApp" }).name, "EvilApp", "control characters dropped");
});

test("dynamic registration: public clients with https or loopback redirects", () => {
  const ok = parseRegistration({ client_name: "VS Code", redirect_uris: ["http://127.0.0.1:33418/", "https://vscode.dev/redirect"] });
  assert.deepEqual(ok, { name: "VS Code", redirectUris: ["http://127.0.0.1:33418/", "https://vscode.dev/redirect"] });
  assert.equal(parseRegistration({ redirect_uris: ["http://localhost/cb"] }).name, "Unnamed app");
  assert.equal(parseRegistration({ redirect_uris: ["cursor://anysphere.cursor-mcp/oauth/callback"] }).field, "redirect_uris");
  assert.equal(parseRegistration({ redirect_uris: [] }).field, "redirect_uris");
  assert.equal(parseRegistration({ redirect_uris: Array(11).fill("https://a.example/cb") }).field, "redirect_uris");
  assert.equal(parseRegistration({ redirect_uris: ["https://a.example/cb"], grant_types: ["client_credentials"] }).field, "metadata");
  assert.equal(parseRegistration("x").field, "metadata");
});

test("non-public addresses are never fetched", () => {
  for (const bad of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "192.0.2.1", "198.51.100.1", "203.0.113.5",
    "::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::1", "2002:7f00::1", "not-an-ip",
  ]) {
    assert.ok(isNonPublicAddress(bad), bad);
  }
  for (const ok of ["104.18.32.47", "8.8.8.8", "172.32.0.1", "2606:4700::6810:202f", "::ffff:8.8.8.8"]) {
    assert.ok(!isNonPublicAddress(ok), ok);
  }
});

test("scope: always collection:read; malformed values fail", () => {
  assert.deepEqual(grantedScope(undefined), { scope: SCOPE });
  assert.deepEqual(grantedScope("collection:read offline_access"), { scope: SCOPE });
  assert.deepEqual(grantedScope("openid profile"), { scope: SCOPE });
  assert.ok("error" in grantedScope("a  b"));
  assert.ok("error" in grantedScope('a"b'));
  assert.ok("error" in grantedScope(["collection:read"]));
});

test("discovery documents name each other and advertise what Claude checks", () => {
  const as = authorizationServerMetadata(ORIGIN);
  const pr = protectedResourceMetadata(ORIGIN);
  assert.equal(pr.resource, "https://pikamd.vercel.app/mcp");
  assert.deepEqual(pr.authorization_servers, [as.issuer]);
  assert.equal(as.issuer, ORIGIN);
  assert.equal(as.client_id_metadata_document_supported, true);
  assert.ok(as.token_endpoint_auth_methods_supported.includes("none"));
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
  assert.equal(as.authorization_response_iss_parameter_supported, true);
  assert.ok(!as.scopes_supported.includes("offline_access"));
  for (const k of ["authorization_endpoint", "token_endpoint", "registration_endpoint", "revocation_endpoint"]) assert.ok(as[k].startsWith(ORIGIN + "/oauth/"), k);
});

test("401 challenge points at the metadata and names the scope", () => {
  assert.equal(
    bearerChallenge(ORIGIN),
    'Bearer resource_metadata="https://pikamd.vercel.app/.well-known/oauth-protected-resource/mcp", scope="collection:read"',
  );
  assert.match(bearerChallenge(ORIGIN, { code: "invalid_token", description: 'bad "token"' }), /^Bearer error="invalid_token", error_description="bad token", resource_metadata=/);
});

test("authorization redirect: code or error, state echoed, iss added, existing query kept", () => {
  const r = new URL(authorizationRedirect("https://claude.ai/api/mcp/auth_callback?a=1", { code: "pmdac_x" }, "s t&=", ORIGIN));
  assert.equal(r.searchParams.get("a"), "1");
  assert.equal(r.searchParams.get("code"), "pmdac_x");
  assert.equal(r.searchParams.get("state"), "s t&=");
  assert.equal(r.searchParams.get("iss"), ORIGIN);
  const e = new URL(authorizationRedirect("http://localhost:4000/cb", { error: "access_denied" }, null, ORIGIN));
  assert.equal(e.searchParams.get("error"), "access_denied");
  assert.equal(e.searchParams.has("state"), false);
  assert.ok(isState("abc") && !isState("") && !isState("a\nb") && !isState("x".repeat(1001)));
});
