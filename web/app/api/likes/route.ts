import { after } from "next/server";
import { sessionWallet } from "@/lib/server/auth";
import { syncRegistry, syncReviews, syncTips } from "@/lib/server/indexer";
import { NO_STORE, notConfigured } from "@/lib/server/guard";
import { likeSummary } from "@/lib/server/likes";
import { getStore } from "@/lib/server/store";

// Like counts for every guideline, plus the slugs the signed-in wallet liked.
// Explore calls this on every visit, so it also nudges the registry, tips and reviews index in the
// background (after the response; at most every couple of minutes, see lib/server/indexer.ts).
export async function GET() {
  const store = getStore();
  if (!store) return notConfigured();
  const logged = (e: unknown) => console.error(`[indexer] ${e instanceof Error ? e.message : e}`);
  after(() => Promise.all([syncRegistry({ budgetMs: 8_000 }).catch(logged), syncTips({ budgetMs: 8_000 }).catch(logged), syncReviews({ budgetMs: 8_000 }).catch(logged)]));
  return Response.json(await likeSummary(store, await sessionWallet()), { headers: NO_STORE });
}
