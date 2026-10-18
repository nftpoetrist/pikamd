import { createHash } from "node:crypto";
import { listGuidelinesForAgents } from "@/lib/data/guidelines";

// The raw file (ARCHITECTURE §9.2): /raw/<slug>.md as plain Markdown, for agents and anyone who
// prefers a URL to MCP. No JavaScript, no sign-in. Same rules as MCP: flagged guidelines aren't
// served, and a text whose sha256 doesn't match the hash on Arc never leaves the server.
const FILE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

const notFound = () =>
  new Response("Guideline not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: RouteContext<"/raw/[file]">) {
  const match = FILE_RE.exec((await ctx.params).file);
  if (!match) return notFound();
  const g = (await listGuidelinesForAgents()).find((x) => x.slug === match[1]);
  if (!g) return notFound();
  if (g.record) {
    const sha = "0x" + createHash("sha256").update(g.content, "utf8").digest("hex");
    if (sha !== g.record.contentHash.toLowerCase()) {
      console.error(`[raw] ${g.slug}: stored text doesn't match its hash on Arc`);
      return new Response("This guideline's text doesn't match its record on Arc, so it isn't served\n", {
        status: 409,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  }
  return new Response(g.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `inline; filename="${g.slug}.md"`,
      // A version's text never changes; a hide or a new version shows up within minutes
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ...(g.record ? { "X-Content-SHA256": g.record.contentHash } : {}),
    },
  });
}
