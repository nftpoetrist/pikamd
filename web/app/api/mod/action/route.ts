import { revalidateTag } from "next/cache";
import { GUIDELINES_TAG } from "@/lib/data/guidelines";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { moderatorWallet } from "@/lib/server/mod-guard";
import { approveFlagged, dismissReports, purgeGuideline, unpinLocked } from "@/lib/server/moderation";
import { rateLimited } from "@/lib/server/ratelimit";

// The moderator actions that live in the index only (locking is the moderator's own Arc
// transaction, see /api/mod/lock): dismiss a guideline's open reports, approve a flagged file for
// agents after reading it, remove a locked guideline's files from our IPFS pins, delete a guideline
// that is off the site on Arc from PikaMd for good.
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  const m = await moderatorWallet();
  if ("error" in m) return m.error;
  const limited = await rateLimited("moderate", { request, wallet: m.wallet });
  if (limited) return limited;

  const body = await readJson(request);
  const id = Number(body?.guidelineId);
  if (!Number.isSafeInteger(id) || id < 1) return fail(400, "Send the guideline id");
  switch (body?.action) {
    case "dismiss":
      return Response.json({ dismissed: await dismissReports(id, m.wallet) }, { headers: NO_STORE });
    case "approve": {
      const approved = await approveFlagged(id, m.wallet);
      if (approved) revalidateTag(GUIDELINES_TAG, { expire: 0 }); // MCP serves it now
      return Response.json({ approved }, { headers: NO_STORE });
    }
    case "unpin":
      return Response.json({ unpinned: await unpinLocked(id, m.wallet) }, { headers: NO_STORE });
    case "purge": {
      const result = await purgeGuideline(id);
      if (!result.purged) {
        if (result.reason === "listed") return fail(409, "It's still on the site: lock it on Arc first");
        if (result.reason === "unpin") return fail(502, "Couldn't remove the file from IPFS, so nothing was deleted. Try again");
        return fail(404, "This guideline isn't on PikaMd");
      }
      revalidateTag(GUIDELINES_TAG, { expire: 0 });
      return Response.json(result, { headers: NO_STORE });
    }
    default:
      return fail(400, "Unknown action");
  }
}
