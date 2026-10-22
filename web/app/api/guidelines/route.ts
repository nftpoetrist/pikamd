import { connection } from "next/server";
import { listFreshGuidelineCards } from "@/lib/data/guidelines";

// The listed guidelines as cards (public, no file contents), at most a second old. Pages show the
// list from their prerendered shell at once and refresh it from here (lib/library/client.ts).
export async function GET() {
  await connection(); // per request: never prerendered at build time
  return Response.json({ guidelines: await listFreshGuidelineCards() }, { headers: { "Cache-Control": "no-store" } });
}
