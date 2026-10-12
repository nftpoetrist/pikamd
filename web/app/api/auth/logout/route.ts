import { isAddress } from "viem";
import { sameWallet } from "@/lib/likes/rules";
import { endSession, sessionWallet } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";

// Ends the session. With { address }, only if the session belongs to that wallet: when the user
// switches accounts, a late "end the old session" call can't end the new one.
export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: false });
  if (rejected) return rejected;

  const only = (await readJson(request))?.address;
  if (typeof only === "string" && isAddress(only, { strict: false })) {
    const current = await sessionWallet();
    if (current && !sameWallet(current, only)) return Response.json({ ok: true, ended: false }, { headers: NO_STORE });
  }
  await endSession();
  return Response.json({ ok: true, ended: true }, { headers: NO_STORE });
}
