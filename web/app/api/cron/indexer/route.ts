import { timingSafeEqual } from "node:crypto";
import { syncRegistry } from "@/lib/server/indexer";
import { NO_STORE } from "@/lib/server/guard";

// Daily catch-up for the registry index (vercel.json; Hobby plans allow one cron run per day).
// Vercel sends `Authorization: Bearer $CRON_SECRET` (vercel.com/docs/cron-jobs/manage-cron-jobs).
// Without CRON_SECRET it only runs in development.
// The sync below stops itself after 50 s; this leaves it room without relying on the platform default
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  // minIntervalS 0: the cron always runs (the lease still stops two syncs at once)
  const result = await syncRegistry({ budgetMs: 50_000, minIntervalS: 0 });
  return Response.json(result, { headers: NO_STORE });
}
