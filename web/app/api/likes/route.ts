import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, notConfigured } from "@/lib/server/guard";
import { likeSummary } from "@/lib/server/likes";
import { getStore } from "@/lib/server/store";

// Like counts for every guideline, plus the slugs the signed-in wallet liked.
export async function GET() {
  const store = getStore();
  if (!store) return notConfigured();
  return Response.json(await likeSummary(store, await sessionWallet()), { headers: NO_STORE });
}
