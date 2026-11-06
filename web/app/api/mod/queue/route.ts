import { NO_STORE } from "@/lib/server/guard";
import { moderatorWallet } from "@/lib/server/mod-guard";
import { moderationQueue } from "@/lib/server/moderation";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// Moderators only: open reports, files the scan flagged, and locked guidelines.
export async function GET() {
  const m = await moderatorWallet();
  if ("error" in m) return m.error;
  return Response.json(await moderationQueue(), { headers: NO_STORE });
}
