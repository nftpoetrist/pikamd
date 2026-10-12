import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, notConfigured } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

// Which wallet this browser is signed in with, if any.
export async function GET() {
  if (!getStore()) return notConfigured();
  return Response.json({ address: await sessionWallet() }, { headers: NO_STORE });
}
