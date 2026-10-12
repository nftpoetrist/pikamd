// End-to-end check of the local MCP server with the official MCP client SDK.
// Run with the dev server up:  npm run mcp:smoke   (PIKAMD_URL overrides http://localhost:3001)
// Connects in both protocol eras (2025 "legacy" handshake and 2026-07-28 "modern"), with a valid
// key, without one and with a wrong one. It swaps in a test key for the run and puts the local
// store (.data/mock-mcp.json, see lib/mcp/mock-store.ts) back exactly as it was afterwards.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const BASE = process.env.PIKAMD_URL ?? "http://localhost:3001";
const DIR = new URL("../.data/", import.meta.url);
const FILE = new URL("mock-mcp.json", DIR);
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
};

const backup = await readFile(FILE, "utf8").catch(() => null);
const key = `pmd_${randomBytes(20).toString("hex")}`;
await mkdir(DIR, { recursive: true });
await writeFile(FILE, JSON.stringify({ keyHash: sha256(key), collection: ["react-performance", "secure-solidity"] }));

async function session(mode, auth) {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : undefined;
  const client = new Client({ name: "pikamd-smoke", version: "1.0.0" }, { versionNegotiation: { mode } });
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", BASE), { requestInit: { headers } }));
  return client;
}
const text = (result) => result.content?.[0]?.text ?? "";

try {
  for (const mode of ["legacy", "auto"]) {
    for (const [name, auth] of [["valid key", key], ["no key", null], ["wrong key", `pmd_${"0".repeat(40)}`]]) {
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

        const read = await client.callTool({ name: "get_guideline", arguments: { slug: "secure-solidity@v3" } });
        check(!read.isError && text(read).startsWith("[Community guideline") && text(read).includes("# Secure Solidity"), `${label} get_guideline`);

        const old = await client.callTool({ name: "get_guideline", arguments: { slug: "secure-solidity", version: "v1" } });
        check(old.isError === true && text(old).includes("latest version"), `${label} older version is explained`);

        const bad = await client.callTool({ name: "search_guidelines", arguments: { query: "" } });
        check(bad.isError === true, `${label} empty query rejected by the schema`);

        const mine = await client.callTool({ name: "my_collection", arguments: {} });
        check(
          auth === key ? !mine.isError && text(mine).includes("has 2 guidelines") : mine.isError === true && text(mine).includes("/connect"),
          `${label} my_collection`,
        );
      } finally {
        await client.close();
      }
    }
  }
} catch (error) {
  failures++;
  console.error("FAIL", error);
} finally {
  if (backup === null) await rm(FILE, { force: true });
  else await writeFile(FILE, backup);
}

console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
