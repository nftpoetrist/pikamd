import { decideLike } from "@/lib/likes/rules";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, notConfigured, sameOriginGuard } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  // The store is the judge of which guidelines exist; this only checks the session and the name's shape
  const decision = decideLike(wallet, slug, { has: (s: string) => SLUG_RE.test(s) && s.length <= 80 });
  if (!decision.ok) return Response.json({ error: decision.error }, { status: decision.status, headers: NO_STORE });

  const result = await store.addLike(wallet!, slug);
  if (!result) return Response.json({ error: "Guideline not found" }, { status: 404, headers: NO_STORE });
  return Response.json({ liked: true, created: result.created, count: result.count }, { headers: NO_STORE });
}
