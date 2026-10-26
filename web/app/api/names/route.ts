import { connection } from "next/server";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE } from "@/lib/server/guard";
import { nameTaken, publishDatabase } from "@/lib/server/publish";

// Publish → Details: is this name free? The page's own list only has listed guidelines, so a
// hidden or locked guideline's name (or one another wallet is publishing right now) used to pass
// Details and fail only at the last step. Answers with the same rules as /api/guidelines/prepare.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: Request) {
  await connection();
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (slug.length > 60 || !SLUG_RE.test(slug)) return Response.json({ error: "Send a name like secure-solidity" }, { status: 400, headers: NO_STORE });
  if (!publishDatabase()) return Response.json({ taken: false }, { headers: NO_STORE });
  return Response.json({ taken: await nameTaken(slug, await sessionWallet()) }, { headers: NO_STORE });
}
