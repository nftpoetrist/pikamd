import { TIPS } from "@/lib/chain";
import { readTips } from "@/lib/tips/events";
import { fetchReceipt } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabase } from "@/lib/server/supabase";
import { recordTips } from "@/lib/server/tips";

// Right after a tip, the browser sends its transaction hash and the server copies the tip into the
// index at once (the indexer would find it later too, ARCHITECTURE §7.4). Only the chain counts:
// Tipped events emitted by our tips contract in a successful transaction; nothing else is read from
// the request. No sign-in: a tip is the tipper's own transaction, and recording it only mirrors
// what is already public on Arc.
const TX_RE = /^0x[0-9a-fA-F]{64}$/;

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  if (!supabase() || !TIPS) return fail(503, "Tips aren't recorded on this server yet");
  const limited = await rateLimited("tipRecord", { request });
  if (limited) return limited;

  const txHash = (await readJson(request))?.txHash;
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) return fail(400, "Send the transaction hash");

  const receipt = await fetchReceipt(txHash as `0x${string}`);
  if (!receipt) return fail(502, "Couldn't read the transaction from Arc yet, try again");
  const tips = readTips(receipt, TIPS.address);
  if ("error" in tips) return fail(400, tips.error);

  const added = await recordTips(tips);
  return Response.json(
    {
      added,
      tips: tips.map((t) => ({ guidelineId: t.guidelineId.toString(), from: t.from, author: t.author, amount: t.amount.toString() })),
    },
    { headers: NO_STORE },
  );
}
