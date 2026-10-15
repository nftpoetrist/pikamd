import { cleanSlugs, mockGuard } from "@/lib/mcp/mock-api";
import { readJson } from "@/lib/server/guard";
import { setCollection } from "@/lib/mcp/mock-store";

// Local preview: mirrors the browser's collection (localStorage) to the store my_collection reads.
// Body: { collection: string[] }, newest first.
export async function PUT(request: Request) {
  const rejected = mockGuard(request, { json: true });
  if (rejected) return rejected;

  const collection = await cleanSlugs((await readJson(request, 128 * 1024))?.collection);
  if (collection === null) return Response.json({ error: "collection must be a list of slugs" }, { status: 400 });

  await setCollection(collection);
  return Response.json({ ok: true });
}
