import { timingSafeEqual } from "node:crypto";
import { syncRegistry, syncTips } from "@/lib/server/indexer";
import { NO_STORE } from "@/lib/server/guard";

// Daily catch-up for the registry and tips index (vercel.json; Hobby plans allow one cron run per day).
// Vercel sends `Authorization: Bearer $CRON_SECRET` (vercel.com/docs/cron-jobs/manage-cron-jobs).
// Without CRON_SECRET it only runs in development.
// The two syncs run side by side and stop themselves after 45 s; this leaves them room without
// relying on the platform default
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
  // minIntervalS 0: the cron always runs (each contract's lease still stops two syncs at once).
  // Settled separately: one failing never hides or stops the other.
  const [registry, tips] = await Promise.allSettled([
    syncRegistry({ budgetMs: 45_000, minIntervalS: 0 }),
    syncTips({ budgetMs: 45_000, minIntervalS: 0 }),
  ]);
  const report = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled" ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
  const failed = registry.status === "rejected" || tips.status === "rejected";
  return Response.json({ registry: report(registry), tips: report(tips) }, { status: failed ? 500 : 200, headers: NO_STORE });
}
