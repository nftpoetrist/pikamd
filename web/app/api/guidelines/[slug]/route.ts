import { getGuideline } from "@/lib/data/guidelines";
import { NO_STORE, publicCache } from "@/lib/server/guard";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// One guideline in full (public), e.g. for the preview opened from a search result.
export async function GET(request: Request, ctx: RouteContext<"/api/guidelines/[slug]">) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return Response.json({ error: "Invalid guideline name" }, { status: 400, headers: NO_STORE });
  }
  const guideline = await getGuideline(slug);
  // Never cached: a guideline published a moment ago must not stay "not found" on the CDN
  if (!guideline) return Response.json({ error: "Guideline not found" }, { status: 404, headers: NO_STORE });
  return Response.json(guideline, { headers: publicCache(request) });
}
