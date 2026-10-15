import { revalidateTag } from "next/cache";
import { REGISTRY } from "@/lib/chain";
import { GUIDELINES_TAG } from "@/lib/data/guidelines";
import { readRegistration } from "@/lib/publish/receipt";
import { fetchReceipt, sessionWallet } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { confirmRegistration, publishDatabase } from "@/lib/server/publish";
import { rateLimited } from "@/lib/server/ratelimit";

// Publish, step 2 (ARCHITECTURE §7.1): after the wallet's register transaction, read the receipt
// from Arc and index the guideline. Only what the chain says counts (lib/publish/receipt.ts).
const TX_RE = /^0x[0-9a-fA-F]{64}$/;

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  if (!publishDatabase() || !REGISTRY) return fail(503, "Publishing isn't live yet on this server");

  const wallet = await sessionWallet();
  if (!wallet) return fail(401, "Sign in with your wallet to publish");
  const limited = await rateLimited("confirm", { request, wallet });
  if (limited) return limited;

  const txHash = (await readJson(request))?.txHash;
  if (typeof txHash !== "string" || !TX_RE.test(txHash)) return fail(400, "Send the transaction hash");

  const receipt = await fetchReceipt(txHash as `0x${string}`);
  if (!receipt) return fail(502, "Couldn't read the transaction from Arc yet, try again");

  const registration = readRegistration(receipt, REGISTRY.address, wallet);
  if ("error" in registration) return fail(400, registration.error);

  const slug = await confirmRegistration(wallet, registration);
  if (!slug) return fail(409, "This registration doesn't match a file you prepared here");

  revalidateTag(GUIDELINES_TAG, { expire: 0 }); // the author sees it on the next page load
  return Response.json({ slug, id: registration.id.toString(), txHash: registration.txHash }, { headers: NO_STORE });
}
