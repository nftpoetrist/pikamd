import "server-only";

// Pinata (ARCHITECTURE §6, K6): uploads happen on the server only, so the JWT never reaches the
// browser (PikaStake had it in index.html, ARC.md §11 #3). Scoped key: Files write only.
// Uploads go to the PUBLIC IPFS network explicitly: Pinata's default is private.

const UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const API_URL = "https://api.pinata.cloud/v3";

export const pinataConfigured = () => !!process.env.PINATA_JWT && !!process.env.PINATA_GATEWAY;

function jwt(): string {
  const value = process.env.PINATA_JWT;
  if (!value) throw new Error("PINATA_JWT is not set");
  return value;
}

const UPLOAD_TIMEOUT_MS = 20_000;
const DELETE_TIMEOUT_MS = 10_000;

/** Pins one Markdown file publicly. Returns its CID and Pinata's file id (for unpinning). */
export async function pinMarkdown(fileName: string, text: string): Promise<{ cid: string; id: string }> {
  const form = new FormData();
  form.append("network", "public");
  form.append("name", fileName);
  form.append("file", new Blob([text], { type: "text/markdown" }), fileName);
  // A guideline is at most 512 KB; a stalled upload must not hold the function (it's billed while it waits)
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt()}` },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  }).catch((error: unknown) => {
    console.error(`[pinata] upload didn't finish: ${error instanceof Error ? error.name : "error"}`);
    throw new Error("IPFS upload failed");
  });
  const body = (await res.json().catch(() => null)) as { data?: { cid?: unknown; id?: unknown } } | null;
  const cid = body?.data?.cid;
  const id = body?.data?.id;
  if (!res.ok || typeof cid !== "string" || typeof id !== "string") {
    console.error(`[pinata] upload failed: HTTP ${res.status}`);
    throw new Error("IPFS upload failed");
  }
  return { cid, id };
}

/**
 * Removes a public pin. True when Pinata removed it (or it was already gone). Pinata gives the same
 * file id to the same content, so callers must check nothing else uses the id (ARC.md §11, #18).
 */
export async function unpin(id: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/files/public/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
  }).catch((error: unknown) => {
    console.error(`[pinata] unpin didn't finish: ${error instanceof Error ? error.name : "error"}`);
    return null;
  });
  if (!res) return false;
  if (!res.ok && res.status !== 404) console.error(`[pinata] unpin failed: HTTP ${res.status}`);
  return res.ok || res.status === 404;
}
