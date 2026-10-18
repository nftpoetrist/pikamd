import "server-only";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE } from "@/lib/server/guard";
import { isModerator } from "@/lib/server/moderation";
import { supabase } from "@/lib/server/supabase";

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

/** The signed-in wallet if it holds MODERATOR_ROLE on Arc right now, else the response to send. */
export async function moderatorWallet(): Promise<{ wallet: `0x${string}` } | { error: Response }> {
  if (!supabase()) return { error: fail(503, "Moderation isn't available on this server yet") };
  const wallet = await sessionWallet();
  if (!wallet) return { error: fail(401, "Sign in with your wallet") };
  let role = false;
  try {
    role = await isModerator(wallet);
  } catch {
    return { error: fail(502, "Couldn't check your role on Arc, try again") };
  }
  if (!role) return { error: fail(403, "This wallet isn't a PikaMd moderator") };
  return { wallet };
}
