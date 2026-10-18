import { sessionWallet } from "@/lib/server/auth";
import { COLLECTION_LIMIT, addToCollection, removeFromCollection } from "@/lib/server/collection";
import { NO_STORE, sameOriginGuard } from "@/lib/server/guard";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabase } from "@/lib/server/supabase";

// Save (PUT) or remove (DELETE) a guideline in the signed-in wallet's collection (K12). No body:
// the wallet comes from the session cookie only. Both are idempotent.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export const PUT = (request: Request, ctx: RouteContext<"/api/collection/[slug]">) => change(request, ctx, true);
export const DELETE = (request: Request, ctx: RouteContext<"/api/collection/[slug]">) => change(request, ctx, false);

async function change(request: Request, ctx: RouteContext<"/api/collection/[slug]">, save: boolean) {
  const rejected = sameOriginGuard(request, { json: false });
  if (rejected) return rejected;
  if (!supabase()) return fail(503, "Collections aren't available on this server yet");
  const wallet = await sessionWallet();
  if (!wallet) return fail(401, "Sign in with your wallet to save guidelines");
  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug) || slug.length > 80) return fail(404, "Guideline not found");
  const limited = await rateLimited("collect", { request, wallet });
  if (limited) return limited;

  if (!save) {
    const r = await removeFromCollection(wallet, slug);
    return Response.json({ saved: false, changed: r.changed, total: r.total }, { headers: NO_STORE });
  }
  const r = await addToCollection(wallet, slug);
  if (r === null) return fail(404, "Guideline not found");
  if (r === "full") return fail(409, `Your collection is full (${COLLECTION_LIMIT} guidelines). Remove one to add another`);
  return Response.json({ saved: true, changed: r.changed, total: r.total }, { headers: NO_STORE });
}
