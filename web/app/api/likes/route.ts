import { after } from "next/server";
import { syncRegistry, syncReviews, syncTips } from "@/lib/server/indexer";
import { notConfigured, publicCache } from "@/lib/server/guard";
import { likeCounts } from "@/lib/server/likes";
import { getStore } from "@/lib/server/store";

// Vercel bills a function for as long as it runs; this one runs the indexer in the background after it answers: 8 s budget + one 5 s Arc call. Defaults: ARCHITECTURE §12.1
export const maxDuration = 20;

// Like counts for every guideline: the same for every visitor, so it never reads the session and
// the CDN keeps it for a few seconds (publicCache). What the signed-in wallet liked is a separate,
// private answer: /api/me/likes.
// Explore calls this on every visit, so it also nudges the registry, tips and reviews index in the
// background (after the response; at most every couple of minutes, see lib/server/indexer.ts).
export async function GET(request: Request) {
  const store = getStore();
  if (!store) return notConfigured();
  const logged = (e: unknown) => console.error(`[indexer] ${e instanceof Error ? e.message : e}`);
  after(() => Promise.all([syncRegistry({ budgetMs: 8_000 }).catch(logged), syncTips({ budgetMs: 8_000 }).catch(logged), syncReviews({ budgetMs: 8_000 }).catch(logged)]));
  return Response.json({ counts: await likeCounts(store) }, { headers: publicCache(request) });
}
