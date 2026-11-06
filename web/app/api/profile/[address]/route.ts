import { getAddress, isAddress } from "viem";
import { NO_STORE, notConfigured } from "@/lib/server/guard";
import { profileFor } from "@/lib/server/likes";
import { getStore } from "@/lib/server/store";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// Public profile numbers for any wallet: PikaGold and guideline count. Public data, so no
// sign-in needed; the navbar shows it as soon as a wallet connects.
export async function GET(_request: Request, ctx: RouteContext<"/api/profile/[address]">) {
  const store = getStore();
  if (!store) return notConfigured();

  const { address } = await ctx.params;
  if (!isAddress(address, { strict: false })) return Response.json({ error: "Invalid address" }, { status: 400, headers: NO_STORE });

  const wallet = getAddress(address);
  return Response.json({ address: wallet, ...(await profileFor(store, wallet)) }, { headers: NO_STORE });
}
