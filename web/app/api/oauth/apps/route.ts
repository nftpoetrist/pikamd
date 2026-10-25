import { connection } from "next/server";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE } from "@/lib/server/guard";
import { connectedApps } from "@/lib/server/oauth";
import { supabase } from "@/lib/server/supabase";

// The signed-in wallet's connected apps: agents it allowed through sign-in (ARCHITECTURE §8.2).
export async function GET() {
  await connection();
  if (!supabase()) return Response.json({ error: "Connected apps aren't available on this server yet" }, { status: 503, headers: NO_STORE });
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ error: "Sign in with your wallet to see your connected apps" }, { status: 401, headers: NO_STORE });
  return Response.json({ apps: await connectedApps(wallet) }, { headers: NO_STORE });
}
