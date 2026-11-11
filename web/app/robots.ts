import type { MetadataRoute } from "next";

// robots.txt (ARCHITECTURE §12.3). PikaMd is public and wants to be found, so everything people
// read stays open to search engines and to assistants fetching a page for their user (/raw is how
// an agent without MCP reads a guideline: it must stay open).
// - /api/ answers the site's own pages and /oauth/ is a sign-in flow, not content: nothing to index,
//   and every crawl of them would run a function.
// - Bulk crawlers that collect pages for model training are asked to stay out: they are the ones
//   that have pushed small Vercel projects over their request quota. Each name below is the
//   robots.txt token from its operator's own documentation (read 2026-11-11): OpenAI (GPTBot),
//   Anthropic (ClaudeBot), Common Crawl (CCBot), Meta (meta-externalagent). Their user-triggered
//   fetchers (ChatGPT-User, Claude-User…) and search crawlers are different tokens and stay allowed.
// A request, not a wall: robots.txt only binds crawlers that choose to honor it.
const TRAINING_CRAWLERS = ["GPTBot", "ClaudeBot", "CCBot", "meta-externalagent"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/oauth/"] },
      { userAgent: TRAINING_CRAWLERS, disallow: "/" },
    ],
  };
}
