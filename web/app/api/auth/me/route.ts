import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, notConfigured } from "@/lib/server/guard";
import { getStore } from "@/lib/server/store";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// Which wallet this browser is signed in with, if any.
export async function GET() {
  if (!getStore()) return notConfigured();
  return Response.json({ address: await sessionWallet() }, { headers: NO_STORE });
}
