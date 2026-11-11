import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, notConfigured } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// The guidelines the signed-in wallet liked (none without a session). Per user, so never cached;
// the counts everyone sees are /api/likes.
export async function GET() {
  const store = getStore();
  if (!store) return notConfigured();
  const wallet = await sessionWallet();
  return Response.json({ mine: wallet ? await store.likedSlugs(wallet) : [] }, { headers: NO_STORE });
}
