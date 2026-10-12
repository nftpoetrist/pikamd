import { listGuidelines } from "@/lib/data/guidelines";
import { decideLike } from "@/lib/likes/rules";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, notConfigured, sameOriginGuard } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

// Like a guideline as the signed-in wallet (K22). No body: the wallet comes from the session
// cookie only. Idempotent: a second like from the same wallet changes nothing. There is no
// DELETE, because likes are permanent.
export async function PUT(request: Request, ctx: RouteContext<"/api/likes/[slug]">) {
  const rejected = sameOriginGuard(request, { json: false });
  if (rejected) return rejected;
  const store = getStore();
  if (!store) return notConfigured();

  const { slug } = await ctx.params;
  const wallet = await sessionWallet();
  const known = new Set((await listGuidelines()).map((g) => g.slug));
  const decision = decideLike(wallet, slug, known);
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status, headers: NO_STORE });

  const created = await store.addLike(wallet!, slug);
  const count = (await store.likeCounts()).get(slug) ?? 0;
  return Response.json({ liked: true, created, count }, { headers: NO_STORE });
}
