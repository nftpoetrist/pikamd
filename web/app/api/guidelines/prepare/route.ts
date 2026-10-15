import { createHash } from "node:crypto";
import { CHAIN, REGISTRY } from "@/lib/chain";
import { validatePublish } from "@/lib/publish/validate";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { pinMarkdown, pinataConfigured } from "@/lib/server/pinata";
import { prepareCheck, publishDatabase, savePending, type PrepareStatus } from "@/lib/server/publish";
import { rateLimited } from "@/lib/server/ratelimit";

// Publish, step 1 (ARCHITECTURE §7.1): check the file again on the server, pin it to IPFS and
// reserve its name for the signed-in wallet. Returns what the wallet then registers on Arc.
const MAX_BODY = 640 * 1024; // the 512 KB file plus its details, as JSON

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

const REFUSED: Record<Exclude<PrepareStatus, "ok">, [number, string]> = {
  slug_taken: [409, "That title is already taken. Try a more specific one"],
  too_many: [429, "You have 5 unfinished uploads. Finish publishing one of them, or wait a day for them to expire"],
  busy: [503, "Publishing is busy right now. Try again in a little while"],
};

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  if (!publishDatabase() || !pinataConfigured() || !REGISTRY) return fail(503, "Publishing isn't live yet on this server");

  const wallet = await sessionWallet();
  if (!wallet) return fail(401, "Sign in with your wallet to publish");
  const limited = (await rateLimited("prepareWallet", { request, wallet })) ?? (await rateLimited("prepareIp", { request }));
  if (limited) return limited;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return fail(413, "The file is over the 512 KB limit");

  const input = validatePublish(await readJson(request, MAX_BODY));
  if ("error" in input) return fail(400, input.error);

  const contentHash = "0x" + createHash("sha256").update(input.content, "utf8").digest("hex");
  const before = await prepareCheck(wallet, input, contentHash);
  if (before !== "ok") return fail(...REFUSED[before]);

  let pin: { cid: string; id: string };
  try {
    pin = await pinMarkdown(`${input.slug}.md`, input.content);
  } catch {
    return fail(502, "Couldn't upload the file to IPFS right now, try again");
  }

  // Never unpin here: Pinata gives identical content the same file id, so this pin may be another
  // author's published guideline. An unused pin costs a few KB; deleting a shared one loses theirs.
  const saved = await savePending(wallet, input, pin, contentHash);
  if (saved !== "ok") return fail(...REFUSED[saved]);

  return Response.json(
    { cid: pin.cid, contentHash, slug: input.slug, scanStatus: input.scanStatus, registry: REGISTRY.address, chainId: CHAIN.id },
    { headers: NO_STORE },
  );
}
