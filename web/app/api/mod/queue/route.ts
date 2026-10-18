import { NO_STORE } from "@/lib/server/guard";
import { moderatorWallet } from "@/lib/server/mod-guard";
import { moderationQueue } from "@/lib/server/moderation";

// Moderators only: open reports, files the scan flagged, and locked guidelines.
export async function GET() {
  const m = await moderatorWallet();
  if ("error" in m) return m.error;
  return Response.json(await moderationQueue(), { headers: NO_STORE });
}
