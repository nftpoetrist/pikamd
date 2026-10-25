// "Connect your agent" (ARCHITECTURE §8, §8.1): one MCP URL + one API key, set up per agent.
// Every config shape below comes from each agent's official docs (verified 2026-10-10):
// Claude Code: code.claude.com/docs/en/mcp · Cursor: cursor.com/docs/context/mcp
// VS Code: code.visualstudio.com/docs/agents/reference/mcp-configuration · Codex: learn.chatgpt.com/docs/extend/mcp.md
// Pure functions, no browser APIs except the key generator, so they run in tests too.

export const SERVER_NAME = "pikamd";
export const KEY_PREFIX = "pmd_";
export const KEY_HEX_LENGTH = 40; // 160 bits (ARCHITECTURE §8)
export const KEY_ENV_VAR = "PIKAMD_API_KEY";
/** Shown in place of the key until the person creates one. */
export const KEY_PLACEHOLDER = "<YOUR_PIKAMD_KEY>";

export type AgentId = "claude-code" | "cursor" | "vscode" | "codex";

/** pmd_ + 40 lowercase hex characters from the platform CSPRNG. */
export function createKey(): string {
  const bytes = new Uint8Array(KEY_HEX_LENGTH / 2);
  crypto.getRandomValues(bytes);
  return KEY_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isKey(value: string): boolean {
  return new RegExp(`^${KEY_PREFIX}[0-9a-f]{${KEY_HEX_LENGTH}}$`).test(value);
}

/**
 * SHA-256 of the key as lowercase hex (Web Crypto, same in the browser and on the server).
 * The server stores only this, never the key (ARCHITECTURE §8).
 */
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** "pmd_3f9a…c21e": enough to recognize a key, never enough to use it. */
export function maskKey(key: string): string {
  return `${key.slice(0, KEY_PREFIX.length + 4)}…${key.slice(-4)}`;
}

export function mcpUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/mcp`;
}

export type AgentSetup = {
  id: AgentId;
  label: string;
  /** Where the snippet goes, one short sentence. */
  where: string;
  /** "shell" snippets are run in a terminal; the rest are file contents. */
  language: "shell" | "json" | "toml";
  snippet: string;
  /** Follow-up lines, one sentence each, no closing period. */
  notes: string[];
};

/** Manual setup for each agent. The key goes in the user-level config only, never a project file. */
export function agentSetups(url: string, key: string): AgentSetup[] {
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      where: "Run this in your terminal",
      language: "shell",
      snippet: `claude mcp add --transport http --scope user ${SERVER_NAME} ${url} \\\n  --header "Authorization: Bearer ${key}"`,
      notes: [
        "--scope user makes PikaMd available in every project and keeps the key out of your repositories",
        "Run /mcp inside Claude Code to check the connection",
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      where: "Add this to ~/.cursor/mcp.json",
      language: "json",
      snippet: JSON.stringify(
        { mcpServers: { [SERVER_NAME]: { url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2,
      ),
      notes: [
        `If the file already lists servers, add only the "${SERVER_NAME}" entry inside mcpServers`,
        "Use the global file in your home folder, not .cursor/mcp.json in a project, so the key stays out of git",
      ],
    },
    {
      id: "vscode",
      label: "VS Code",
      where: "Command Palette → MCP: Open User Configuration, then add this",
      language: "json",
      snippet: JSON.stringify(
        {
          inputs: [{ type: "promptString", id: "pikamd-key", description: "PikaMd API key", password: true }],
          servers: {
            [SERVER_NAME]: { type: "http", url, headers: { Authorization: "Bearer ${input:pikamd-key}" } },
          },
        },
        null,
        2,
      ),
      notes: [
        "The key isn't written in this file: VS Code asks for it the first time the server starts and stores it securely",
        "If the file already has inputs or servers, add these entries to the existing lists",
      ],
    },
    {
      id: "codex",
      label: "Codex",
      where: "Add this to ~/.codex/config.toml",
      language: "toml",
      snippet: `[mcp_servers.${SERVER_NAME}]\nurl = "${url}"\nbearer_token_env_var = "${KEY_ENV_VAR}"`,
      notes: [
        `Then add export ${KEY_ENV_VAR}="${key}" to your shell profile (~/.zshrc or ~/.bashrc) and open a new terminal`,
        "Codex reads the key from that variable, so it never sits in the config file",
      ],
    },
  ];
}

/** One prompt for any agent: it picks the setup that matches the app it runs in (K19). */
export function agentPrompt(url: string, key: string): string {
  return `Connect me to the PikaMd MCP server so you can read my guideline collection.
Server name: ${SERVER_NAME}
URL: ${url}
API key: ${key}

Set it up the way the app you're running in supports:
- Claude Code: run claude mcp add --transport http --scope user ${SERVER_NAME} ${url} --header "Authorization: Bearer ${key}"
- Cursor: add "${SERVER_NAME}": { "url": "${url}", "headers": { "Authorization": "Bearer ${key}" } } under "mcpServers" in ~/.cursor/mcp.json
- VS Code: add "${SERVER_NAME}": { "type": "http", "url": "${url}", "headers": { "Authorization": "Bearer ${key}" } } under "servers" in the user mcp.json (MCP: Open User Configuration)
- Codex: add [mcp_servers.${SERVER_NAME}] with url = "${url}" and bearer_token_env_var = "${KEY_ENV_VAR}" to ~/.codex/config.toml, then ask me before adding export ${KEY_ENV_VAR}="${key}" to my shell profile
- Any other MCP client: add a Streamable HTTP server with this URL and the header Authorization: Bearer <key>

Rules:
- Use my user-level settings only. Never put the key in a project file or a git repository.
- Keep every server that is already configured.
- Don't repeat the key back to me.
- If you can't change your own settings, show me the steps instead.
- When you're done, tell me whether I need to restart the app, then list the tools you see from ${SERVER_NAME}.`;
}

/** Tools the server will expose (ARCHITECTURE §8). */
export const MCP_TOOLS: { name: string; text: string }[] = [
  { name: "search_guidelines", text: "Finds guidelines by topic or tag" },
  { name: "get_guideline", text: "Reads a full guideline, the latest version" },
  { name: "my_collection", text: "Lists the guidelines you saved, newest first (needs sign-in or a key)" },
];

/** Plain-language requests to try once connected. */
export const EXAMPLE_ASKS = [
  "What's in my PikaMd collection?",
  "Fill the gaps in my CLAUDE.md using the Secure Solidity guideline from my PikaMd collection",
  "Search PikaMd for a guideline about React performance and summarize it",
];
