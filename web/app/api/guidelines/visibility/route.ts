import { revalidateTag } from "next/cache";
import { REGISTRY } from "@/lib/chain";
import { GUIDELINES_TAG } from "@/lib/data/guidelines";
import { readHiddenChange } from "@/lib/publish/receipt";
import { REGISTRY_ABI } from "@/lib/registry-abi";
import { arcClient, fetchReceipt, sessionWallet } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { applyFlags } from "@/lib/server/owned";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabase } from "@/lib/server/supabase";

// Hide / Show again on My Collection → Shared by me: after the author's setHidden transaction,
// read it from Arc and copy the guideline's flags to the index at once (the indexer would catch it
// later too, §7.4). Only the chain counts: the registry's HiddenSet event in the receipt, then the
// guideline itself read at that block (its author and both flags), never values from the request.
const TX_RE = /^0x[0-9a-fA-F]{64}$/;

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  if (!supabase() || !REGISTRY) return fail(503, "Hiding guidelines isn't live yet on this server");

  const wallet = await sessionWallet();
  if (!wallet) return fail(401, "Sign in with your wallet first");
  const limited = await rateLimited("visibility", { request, wallet });
  if (limited) return limited;

  const txHash = (await readJson(request))?.txHash;
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) return fail(400, "Send the transaction hash");

  const receipt = await fetchReceipt(txHash as `0x${string}`);
  if (!receipt) return fail(502, "Couldn't read the transaction from Arc yet, try again");
  const change = readHiddenChange(receipt, REGISTRY.address);
  if ("error" in change) return fail(400, change.error);

  // The guideline as of that block: a load-balanced RPC may need a moment to reach it
  let onChain;
  for (let attempt = 1; ; attempt++) {
    try {
      onChain = await arcClient.readContract({
        address: REGISTRY.address,
        abi: REGISTRY_ABI,
        functionName: "getGuideline",
        args: [change.id],
        blockNumber: change.blockNumber,
      });
      break;
    } catch {
      if (attempt >= 3) return fail(502, "Couldn't read the guideline from Arc yet, try again");
      await sleep(1000);
    }
  }
  if (onChain.author.toLowerCase() !== wallet.toLowerCase()) return fail(403, "This guideline belongs to another wallet");

  const flags = { hidden: onChain.authorHidden, locked: onChain.moderatorLocked };
  const slug = await applyFlags(change.id, wallet, flags);
  if (!slug) return fail(404, "This guideline isn't on PikaMd");

  revalidateTag(GUIDELINES_TAG, { expire: 0 }); // Explore, search and MCP follow on the next read
  return Response.json({ id: change.id.toString(), slug, ...flags }, { headers: NO_STORE });
}
