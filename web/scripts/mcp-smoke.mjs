// End-to-end check of the MCP server with the official MCP client SDK.
// Run with the dev server up:  npm run mcp:smoke   (PIKAMD_URL overrides http://localhost:3001)
// Connects in both protocol eras (2025 "legacy" handshake and 2026-07-28 "modern"), with a valid
// key and without one; a wrong or replaced key is refused with 401 (since OAuth, 2026-10-25: a
// credential that doesn't work must not pass as anonymous). The key belongs to a throwaway test
// wallet in the development database (only its SHA-256 is stored, like a real key); the wallet's
// collection and keys are deleted before and after the run.
import { createHash, randomBytes } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import { clearTestCollections, devDatabase, rpc } from "./smoke-guard.mjs";

// Needs the sample guidelines (npm run db:seed on the development project)
const db = await devDatabase("mcp:smoke");
if (!db) {
  console.error("mcp:smoke: needs the development database (SUPABASE_URL in web/.env.local): keys and collections live there");
  process.exit(2);
}

const BASE = process.env.PIKAMD_URL ?? "http://localhost:3001";
const WALLET = "0x" + "5e".repeat(20); // never a real wallet: no key exists for it
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const masked = (k) => `${k.slice(0, 8)}…${k.slice(-4)}`;

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
};

await clearTestCollections(db, [WALLET]);
const revoked = `pmd_${randomBytes(20).toString("hex")}`;
await rpc(db, "replace_mcp_key", { p_wallet: WALLET, p_hash: sha256(revoked), p_masked: masked(revoked) });
const key = `pmd_${randomBytes(20).toString("hex")}`;
await rpc(db, "replace_mcp_key", { p_wallet: WALLET, p_hash: sha256(key), p_masked: masked(key) }); // replaces the first
await rpc(db, "add_to_collection", { p_wallet: WALLET, p_slug: "secure-solidity" });
await rpc(db, "add_to_collection", { p_wallet: WALLET, p_slug: "react-performance" }); // newest

async function session(mode, auth) {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : undefined;
  const client = new Client({ name: "pikamd-smoke", version: "1.0.0" }, { versionNegotiation: { mode } });
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", BASE), { requestInit: { headers } }));
  return client;
}
const text = (result) => result.content?.[0]?.text ?? "";

try {
  for (const mode of ["legacy", "auto"]) {
    for (const [name, auth] of [["valid key", key], ["no key", null]]) {
      const label = `[${mode} · ${name}]`;
      const client = await session(mode, auth);
      try {
        const era = client.getProtocolEra();
        check(era === (mode === "auto" ? "modern" : "legacy"), `${label} era ${era} (${client.getNegotiatedProtocolVersion()})`);
        check(client.getInstructions()?.startsWith("PikaMd is a public library") === true, `${label} server instructions`);

        const { tools } = await client.listTools();
        check(tools.map((t) => t.name).sort().join() === "get_guideline,my_collection,search_guidelines", `${label} three tools`);
        check(tools.every((t) => t.annotations?.readOnlyHint === true), `${label} all tools read-only`);

        const search = await client.callTool({ name: "search_guidelines", arguments: { query: "solidity" } });
        check(!search.isError && text(search).includes("secure-solidity@v3"), `${label} search_guidelines`);

        const inFile = await client.callTool({ name: "search_guidelines", arguments: { query: "reentrancy kind:rules" } });
        check(!inFile.isError && /line \d+: .*reentrancy/i.test(text(inFile)), `${label} search finds text inside files, with line numbers`);

        const read = await client.callTool({ name: "get_guideline", arguments: { slug: "secure-solidity@v3" } });
        check(!read.isError && text(read).startsWith("[Community guideline") && text(read).includes("# Secure Solidity"), `${label} get_guideline`);

        const old = await client.callTool({ name: "get_guideline", arguments: { slug: "secure-solidity", version: "v1" } });
        check(old.isError === true && text(old).includes("latest version"), `${label} older version is explained`);

        const bad = await client.callTool({ name: "search_guidelines", arguments: { query: "" } });
        check(bad.isError === true, `${label} empty query rejected by the schema`);

        if (auth === key) {
          const mine = await client.callTool({ name: "my_collection", arguments: {} });
          check(
            !mine.isError && text(mine).includes("has 2 guidelines") && text(mine).indexOf("react-performance") < text(mine).indexOf("secure-solidity"),
            `${label} my_collection (the wallet's 2, newest first)`,
          );
        } else {
          // Lazy authentication: the HTTP request fails with 401 so the agent can start sign-in
          const status = await client.callTool({ name: "my_collection", arguments: {} }).then(() => 200, (e) => e?.status ?? e?.data?.status ?? String(e));
          check(status === 401 || /401|invalid_token/.test(String(status)), `${label} my_collection without a key → 401 (sign-in), not a tool error (${status})`);
        }
      } finally {
        await client.close();
      }
    }
  }
} catch (error) {
  failures++;
  console.error("FAIL", error);
}

// A wrong or replaced key: every request is refused with 401 invalid_token and a challenge
for (const [name, bad] of [["wrong key", `pmd_${"0".repeat(40)}`], ["replaced key", revoked]]) {
  const res = await fetch(new URL("/mcp", BASE), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${bad}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "1" } } }),
  });
  const www = res.headers.get("www-authenticate") ?? "";
  check(res.status === 401 && www.includes('error="invalid_token"') && www.includes("resource_metadata="), `[${name}] refused with 401 invalid_token and resource_metadata`);
}

try {
  const [info] = await rpc(db, "mcp_key_info", { p_wallet: WALLET });
  check(!!info?.last_used_at, "the key is marked as used by an agent");
} finally {
  await clearTestCollections(db, [WALLET]);
}

console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
