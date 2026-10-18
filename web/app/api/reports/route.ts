import { NOTE_MAX, isReason } from "@/lib/moderation/reasons";
import { sessionWallet } from "@/lib/server/auth";
import { NO_STORE, readJson, sameOriginGuard } from "@/lib/server/guard";
import { addReport } from "@/lib/server/moderation";
import { rateLimited } from "@/lib/server/ratelimit";
import { supabase } from "@/lib/server/supabase";

// Report a guideline (ARCHITECTURE §9.2): signed in, one report per wallet per guideline, a known
// reason and an optional note. Moderators see it on /mod.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function POST(request: Request) {
  const rejected = sameOriginGuard(request, { json: true });
  if (rejected) return rejected;
  if (!supabase()) return fail(503, "Reports aren't available on this server yet");
  const wallet = await sessionWallet();
  if (!wallet) return fail(401, "Sign in with your wallet to report a guideline");
  const limited = await rateLimited("report", { request, wallet });
  if (limited) return limited;

  const body = await readJson(request);
  const slug = body?.slug;
  const reason = body?.reason;
  const note = typeof body?.note === "string" ? body.note.trim() : body?.note == null ? "" : null;
  if (typeof slug !== "string" || !SLUG_RE.test(slug) || slug.length > 80) return fail(404, "Guideline not found");
  if (!isReason(reason)) return fail(400, "Pick a reason");
  if (note === null || note.length > NOTE_MAX) return fail(400, `Keep the note under ${NOTE_MAX} characters`);
  if (reason === "other" && !note) return fail(400, "Tell us what's wrong in the note");

  const created = await addReport(wallet, slug, reason, note || null);
  if (created === null) return fail(404, "Guideline not found");
  return Response.json({ reported: true, first: created }, { headers: NO_STORE });
}
