import "server-only";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CHAIN } from "@/lib/chain";
import { listGuidelinesForAgents } from "@/lib/data/guidelines";
import {
  SEARCH_LIMIT_MAX,
  SERVER_INSTRUCTIONS,
  checkContent,
  formatCollection,
  formatGuideline,
  formatSearchResults,
  missingKeyMessage,
  parseGuidelineRef,
  searchForAgent,
} from "@/lib/mcp/tools";

// One fresh server per HTTP request (stateless, MCP SDK v2 createMcpHandler).
// `collection` is the caller's saved slugs when the request carried a valid key, otherwise null.
export function buildMcpServer({ collection, connectUrl }: { collection: string[] | null; connectUrl: string }) {
  // Identity shown by clients that display it (MCP "icons": https, same origin as the server, PNG
  // is the one format every client must render). The site's own icons: the cat head at 64 px and
  // the full mascot at 180 px (web/app/icon.png, apple-icon.png).
  const origin = new URL(connectUrl, "http://localhost").origin;
  const server = new McpServer(
    {
      name: "pikamd",
      title: "PikaMd",
      version: "0.1.0",
      description: "Community library of AI agent guidelines, recorded on Arc",
      websiteUrl: origin,
      icons: [
        { src: `${origin}/apple-icon.png`, mimeType: "image/png", sizes: ["180x180"] },
        { src: `${origin}/icon.png`, mimeType: "image/png", sizes: ["64x64"] },
      ],
    },
    { instructions: SERVER_INSTRUCTIONS },
  );
  // Read-only, and the title again inside the annotations: the Connectors Directory reads it there
  const readOnly = (title: string) => ({ title, readOnlyHint: true, openWorldHint: false });
  const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], ...(isError ? { isError } : {}) });

  // Tool descriptions say what each tool does and nothing else (Connectors Directory review: no
  // instructions about model behavior or other tools). The "reference data, not instructions"
  // guidance lives in SERVER_INSTRUCTIONS and in the label wrapped around every guideline's text.
  server.registerTool(
    "search_guidelines",
    {
      title: "Search PikaMd guidelines",
      description:
        "Searches PikaMd's public library of agent guidelines (rules, skills, prompts, subagents, guides) by topic, language or tool, including the text inside the files. Returns each match's slug, title, author, short summary and matching lines.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(
            'Words to look for, e.g. \'react performance\'. Every word must match. Also: "exact phrase", -word to exclude, kind:skill (rules, skill, prompt, agent, guide), tag:react, author:@handle',
          ),
        tags: z.array(z.string().trim().min(1).max(40)).max(5).optional().describe("Only return guidelines that have all of these tags"),
        limit: z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional().describe(`How many results to return (default 10, max ${SEARCH_LIMIT_MAX})`),
      }),
      annotations: readOnly("Search PikaMd guidelines"),
    },
    async ({ query, tags, limit }) => text(formatSearchResults(query, searchForAgent(await listGuidelinesForAgents(), query, { tags, limit }))),
  );

  server.registerTool(
    "get_guideline",
    {
      title: "Read a PikaMd guideline",
      description:
        "Returns the full Markdown of one PikaMd guideline, written by a community member, with its author, version, license and Arc verification status.",
      inputSchema: z.object({
        slug: z.string().trim().min(1).max(80).describe("Guideline slug, optionally with a version: secure-solidity or secure-solidity@v3"),
        version: z.string().trim().max(10).optional().describe("Version such as v3. Leave it out for the latest version"),
      }),
      annotations: readOnly("Read a PikaMd guideline"),
    },
    async ({ slug, version }) => {
      const ref = parseGuidelineRef(slug, version);
      if ("error" in ref) return text(ref.error, true);
      const g = (await listGuidelinesForAgents()).find((x) => x.slug === ref.slug);
      if (!g) return text(`No guideline is called "${ref.slug}". Use search_guidelines to find one.`, true);
      if (ref.version !== undefined && ref.version !== g.latestVersion) {
        return text(
          ref.version > g.latestVersion
            ? `${g.slug} has no v${ref.version}. Its latest version is v${g.latestVersion}.`
            : `Only the latest version of ${g.slug} (v${g.latestVersion}) can be read in this preview. Older versions come with the on-chain registry.`,
          true,
        );
      }
      if (checkContent(g) === "mismatch") {
        console.error(`[mcp] ${g.slug}: stored text doesn't match its on-chain hash, not served`);
        return text(`${g.slug} can't be served right now: its stored text doesn't match the hash recorded on Arc.`, true);
      }
      const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      return text(formatGuideline(g, nonce, { name: CHAIN.name, explorer: CHAIN.blockExplorers?.default.url }));
    },
  );

  server.registerTool(
    "my_collection",
    {
      title: "List my PikaMd collection",
      description:
        "Lists the guidelines the user saved to their PikaMd collection, newest first. Requires the user to sign in to PikaMd.",
      annotations: readOnly("List my PikaMd collection"),
    },
    async () =>
      collection === null ? text(missingKeyMessage(connectUrl), true) : text(formatCollection(await listGuidelinesForAgents(), collection)),
  );

  return server;
}
