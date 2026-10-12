// Run: npm test  (node --experimental-strip-types --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KEY_ENV_VAR,
  KEY_PLACEHOLDER,
  SERVER_NAME,
  agentPrompt,
  agentSetups,
  createKey,
  isKey,
  maskKey,
  mcpUrl,
} from "./connect.ts";
import { scanGuideline } from "../scan.ts";

const URL = "https://pikamd.example/mcp";

test("keys are pmd_ + 40 lowercase hex and unique", () => {
  const a = createKey();
  const b = createKey();
  assert.match(a, /^pmd_[0-9a-f]{40}$/);
  assert.ok(isKey(a));
  assert.notEqual(a, b);
  assert.ok(!isKey("pmd_123"));
  assert.ok(!isKey(a.toUpperCase()));
});

test("a mask never reveals the usable key", () => {
  const key = createKey();
  const masked = maskKey(key);
  assert.equal(masked, `${key.slice(0, 8)}…${key.slice(-4)}`);
  assert.ok(!isKey(masked));
});

test("the MCP URL is the origin plus /mcp", () => {
  assert.equal(mcpUrl("https://pikamd.example"), URL);
  assert.equal(mcpUrl("https://pikamd.example/"), URL);
  assert.equal(mcpUrl("http://localhost:3001"), "http://localhost:3001/mcp");
});

test("every agent setup points at the same server", () => {
  const key = createKey();
  const setups = agentSetups(URL, key);
  assert.deepEqual(setups.map((s) => s.id), ["claude-code", "cursor", "vscode", "codex"]);
  for (const s of setups) assert.ok(s.snippet.includes(URL), s.id);
});

test("JSON snippets are valid and match each app's documented shape", () => {
  const key = createKey();
  const [, cursor, vscode] = agentSetups(URL, key);

  const c = JSON.parse(cursor.snippet);
  assert.deepEqual(c, { mcpServers: { [SERVER_NAME]: { url: URL, headers: { Authorization: `Bearer ${key}` } } } });

  const v = JSON.parse(vscode.snippet);
  assert.equal(v.servers[SERVER_NAME].type, "http");
  assert.equal(v.servers[SERVER_NAME].url, URL);
  assert.equal(v.servers[SERVER_NAME].headers.Authorization, "Bearer ${input:pikamd-key}");
  assert.equal(v.inputs[0].id, "pikamd-key");
  assert.equal(v.inputs[0].password, true);
});

test("VS Code and Codex files never contain the key itself", () => {
  const key = createKey();
  const [claude, cursor, vscode, codex] = agentSetups(URL, key);
  assert.ok(claude.snippet.includes(key));
  assert.ok(cursor.snippet.includes(key));
  assert.ok(!vscode.snippet.includes(key));
  assert.ok(!codex.snippet.includes(key));
  assert.ok(codex.snippet.includes(`bearer_token_env_var = "${KEY_ENV_VAR}"`));
  assert.ok(codex.notes.some((n) => n.includes(`export ${KEY_ENV_VAR}="${key}"`)));
});

test("the Claude Code command uses the user scope and the bearer header", () => {
  const key = createKey();
  const [claude] = agentSetups(URL, key);
  assert.ok(claude.snippet.startsWith(`claude mcp add --transport http --scope user ${SERVER_NAME} ${URL}`));
  assert.ok(claude.snippet.includes(`--header "Authorization: Bearer ${key}"`));
});

test("the agent prompt carries the URL and key and covers every agent", () => {
  const key = createKey();
  const prompt = agentPrompt(URL, key);
  assert.ok(prompt.includes(`URL: ${URL}`));
  assert.ok(prompt.includes(`API key: ${key}`));
  for (const app of ["Claude Code", "Cursor", "VS Code", "Codex", "Any other MCP client"]) assert.ok(prompt.includes(app), app);
  assert.ok(prompt.includes("Never put the key in a project file"));
});

test("the placeholder renders without looking like a key", () => {
  const setups = agentSetups(URL, KEY_PLACEHOLDER);
  assert.ok(setups[0].snippet.includes(KEY_PLACEHOLDER));
  assert.ok(!isKey(KEY_PLACEHOLDER));
});

test("the publish scanner blocks a PikaMd key pasted into a guideline", () => {
  const key = createKey();
  const findings = scanGuideline(`Use this key: ${key}`).findings;
  assert.ok(findings.some((f) => f.rule === "pikamd-key"));
});
