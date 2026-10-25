import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, sameOriginGuard } from "@/lib/server/guard";
import { disconnectApp } from "@/lib/server/oauth";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabase } from "@/lib/server/supabase";

// Disconnect one app: its tokens stop working at once. Only the wallet's own apps.
export async function DELETE(request: Request, ctx: RouteContext<"/api/oauth/apps/[id]">) {
  const rejected = sameOriginGuard(request, { json: false });
  if (rejected) return rejected;
  if (!supabase()) return Response.json({ error: "Connected apps aren't available on this server yet" }, { status: 503, headers: NO_STORE });
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ error: "Sign in with your wallet first" }, { status: 401, headers: NO_STORE });
  const limited = await rateLimited("oauthConsent", { request, wallet });
  if (limited) return limited;
  const { id } = await ctx.params;
  return Response.json({ disconnected: await disconnectApp(wallet, id) }, { headers: NO_STORE });
}
