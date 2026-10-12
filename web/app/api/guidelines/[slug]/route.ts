import { getGuideline } from "@/lib/data/guidelines";

// One guideline in full (public), e.g. for the preview opened from a search result.
export async function GET(_request: Request, ctx: RouteContext<"/api/guidelines/[slug]">) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return Response.json({ error: "Invalid guideline name" }, { status: 400 });
  }
  const guideline = await getGuideline(slug);
  if (!guideline) return Response.json({ error: "Guideline not found" }, { status: 404 });
  return Response.json(guideline, { headers: { "Cache-Control": "no-store" } });
}
