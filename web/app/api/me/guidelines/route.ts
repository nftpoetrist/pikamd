import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE } from "@/lib/server/guard";
import { ownedGuidelines } from "@/lib/server/owned";
import { supabase } from "@/lib/server/supabase";

// "Shared by me" on My Collection: the signed-in wallet's own guidelines, hidden and locked ones
// too. Hidden guidelines are for their author only, so this needs the session (one free signature).
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function GET() {
  if (!supabase()) return fail(503, "Your shared guidelines aren't available on this server yet");
  const wallet = await sessionWallet();
  if (!wallet) return fail(401, "Sign in with your wallet to see the guidelines you shared");
  return Response.json({ guidelines: await ownedGuidelines(wallet) }, { headers: NO_STORE });
}
