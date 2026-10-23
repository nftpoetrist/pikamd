import { revalidateTag } from "next/cache";
import { REVIEWS } from "@/lib/chain";
import { GUIDELINES_TAG } from "@/lib/data/guidelines";
import { readReviews } from "@/lib/reviews/events";
import { fetchReceipt } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { moderatorWallet } from "@/lib/server/mod-guard";
import { rateLimited } from "@/lib/server/ratelimit";
import { logReviews, recordReviews } from "@/lib/server/reviews";

// After a moderator's approve / revoke on GuidelineReviews: read it from Arc and copy it to the
// index at once (the indexer would catch it later too, §7.4). Only the chain counts: the reviews
// contract's own events (only MODERATOR_ROLE holders can emit them) naming this moderator.
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  if (!REVIEWS) return fail(503, "Reviews aren't available on this network yet");
  const m = await moderatorWallet();
  if ("error" in m) return m.error;
  const limited = await rateLimited("moderate", { request, wallet: m.wallet });
  if (limited) return limited;

  const txHash = (await readJson(request))?.txHash;
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) return fail(400, "Send the transaction hash");
  const receipt = await fetchReceipt(txHash as `0x${string}`);
  if (!receipt) return fail(502, "Couldn't read the transaction from Arc yet, try again");
  const events = readReviews(receipt, REVIEWS.address);
  if ("error" in events) return fail(400, events.error);
  if (events.some((e) => e.moderator.toLowerCase() !== m.wallet.toLowerCase())) return fail(403, "Another moderator sent this change");

  await recordReviews(events);
  await logReviews(events, m.wallet);
  revalidateTag(GUIDELINES_TAG, { expire: 0 });
  const last = events[events.length - 1];
  return Response.json({ id: last.guidelineId.toString(), reviewed: last.reviewed, version: last.version }, { headers: NO_STORE });
}
