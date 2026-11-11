import { connection } from "next/server";
import { listFreshGuidelineCards } from "@/lib/data/guidelines";
import { publicCache } from "@/lib/server/guard";

// Answers in well under a second; capped so a stalled call can't run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 10;

// The listed guidelines as cards (public, no file contents). Pages show the list from their
// prerendered shell at once and refresh it from here (lib/library/client.ts). The same for every
// visitor, so the CDN keeps it for a few seconds (publicCache).
export async function GET(request: Request) {
  await connection(); // per request: never prerendered at build time
  return Response.json({ guidelines: await listFreshGuidelineCards() }, { headers: publicCache(request) });
}
