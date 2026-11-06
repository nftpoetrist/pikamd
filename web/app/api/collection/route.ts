import { sessionWallet } from "@/lib/server/auth";
import { COLLECTION_LIMIT, collectionSlugs } from "@/lib/server/collection";
import { NO_STORE } from "@/lib/server/guard";
import { supabase } from "@/lib/server/supabase";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// My Collection → Saved (K12): the signed-in wallet's saved guidelines, newest first. The same list
// the wallet's MCP key opens for my_collection.
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function GET() {
  if (!supabase()) return fail(503, "Collections aren't available on this server yet");
  const wallet = await sessionWallet();
  if (!wallet) return fail(401, "Sign in with your wallet to see your collection");
  return Response.json({ slugs: await collectionSlugs(wallet), limit: COLLECTION_LIMIT }, { headers: NO_STORE });
}
