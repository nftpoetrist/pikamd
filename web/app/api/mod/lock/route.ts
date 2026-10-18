import { revalidateTag } from "next/cache";
import { REGISTRY } from "@/lib/chain";
import { GUIDELINES_TAG } from "@/lib/data/guidelines";
import { readLockChange } from "@/lib/publish/receipt";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import { arcClient, fetchReceipt } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { moderatorWallet } from "@/lib/server/mod-guard";
import { applyLock } from "@/lib/server/moderation";
import { rateLimited } from "@/lib/server/ratelimit";

// After a moderator's setModeratorLock transaction: read it from Arc and copy the guideline's
// flags to the index at once (the indexer would catch it later too, §7.4). Only the chain counts:
// the registry's ModeratorLockSet event (only role holders can emit it) naming this moderator,
// then both flags read at that block. A lock also closes the guideline's open reports.
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  if (!REGISTRY) return fail(503, "Moderation isn't available on this network yet");
  const m = await moderatorWallet();
  if ("error" in m) return m.error;
  const limited = await rateLimited("moderate", { request, wallet: m.wallet });
  if (limited) return limited;

  const txHash = (await readJson(request))?.txHash;
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) return fail(400, "Send the transaction hash");
  const receipt = await fetchReceipt(txHash as `0x${string}`);
  if (!receipt) return fail(502, "Couldn't read the transaction from Arc yet, try again");
  const change = readLockChange(receipt, REGISTRY.address);
  if ("error" in change) return fail(400, change.error);
  if (change.moderator.toLowerCase() !== m.wallet.toLowerCase()) return fail(403, "Another moderator sent this change");

  let onChain;
  for (let attempt = 1; ; attempt++) {
    try {
      onChain = await arcClient.readContract({ address: REGISTRY.address, abi: REGISTRY_ABI, functionName: "getGuideline", args: [change.id], blockNumber: change.blockNumber });
      break;
    } catch {
      if (attempt >= 3) return fail(502, "Couldn't read the guideline from Arc yet, try again");
      await sleep(1000);
    }
  }
  const flags = { hidden: onChain.authorHidden, locked: onChain.moderatorLocked };
  if (!(await applyLock(change, flags, m.wallet))) return fail(404, "This guideline isn't on PikaMd");
  revalidateTag(GUIDELINES_TAG, { expire: 0 });
  return Response.json({ id: change.id.toString(), ...flags }, { headers: NO_STORE });
}
