// Fills the DEVELOPMENT Supabase project with the sample guidelines (lib/data/mock-guidelines.ts)
// so localhost has content and the smoke tests have data. Refuses the live project.
// Safe to run again: rows are upserted, likes are added only once.
//   npm run db:seed
// The rows are dev-only stand-ins: fake tx hashes (sha256 of a label), block 0, and a CID that
// isn't on IPFS. content_hash is the real sha256 of each sample's text. Their ids start at
// SEED_ID_BASE so they never collide with real registrations, whose on-chain ids start at 1
// (a seed at id 1 once broke the first real publish in development).
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { MOCK_GUIDELINES } from "../lib/data/mock-guidelines.ts";
import { LIVE_SUPABASE_REF, readEnvLocal } from "./smoke-guard.mjs";

const env = await readEnvLocal();
if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error("db:seed: set SUPABASE_URL and SUPABASE_SECRET_KEY for the development project in web/.env.local");
  process.exit(2);
}
const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (ref === LIVE_SUPABASE_REF) {
  console.error(`db:seed: refused. ${ref} is the LIVE project; sample data only goes into the development project.`);
  process.exit(2);
}

const SEED_ID_BASE = 900_000_000;
const seedId = (mockId) => SEED_ID_BASE + mockId;
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (what, error) => {
  console.error(`db:seed: ${what} failed: ${error.code ?? ""} ${error.message}`);
  process.exit(1);
};

// Earlier seeds used the sample ids themselves (1..18): remove those first (seed rows have block 0)
const oldIds = MOCK_GUIDELINES.map((g) => g.id);
for (const table of ["stars", "collections", "guideline_versions"]) {
  const res = await db.from(table).delete().in("guideline_id", oldIds).in("guideline_id",
    (await db.from("guidelines").select("id").in("id", oldIds).eq("block_number", 0)).data?.map((r) => r.id) ?? []);
  if (res.error) fail(`cleanup ${table}`, res.error);
}
{
  const res = await db.from("guidelines").delete().in("id", oldIds).eq("block_number", 0);
  if (res.error) fail("cleanup guidelines", res.error);
}

const guidelines = MOCK_GUIDELINES.map((g) => ({
  id: seedId(g.id),
  slug: g.slug,
  author_address: g.author.address.toLowerCase(),
  title: g.title,
  description: g.description,
  kind: g.kind,
  tags: g.tags,
  license: 0,
  latest_version: g.latestVersion,
  uses_count: g.uses,
  tx_hash: "0x" + sha(`dev-seed:${g.slug}`),
  block_number: 0,
}));
const versions = MOCK_GUIDELINES.map((g) => ({
  guideline_id: seedId(g.id),
  version: g.latestVersion,
  cid: `dev-seed-${g.slug}`,
  content_hash: "0x" + sha(g.content),
  content: g.content,
  tx_hash: "0x" + sha(`dev-seed:${g.slug}`),
  block_number: 0,
  log_index: 0,
}));

let r = await db.from("guidelines").upsert(guidelines, { onConflict: "id" });
if (r.error) fail("guidelines", r.error);
r = await db.from("guideline_versions").upsert(versions, { onConflict: "guideline_id,version" });
if (r.error) fail("guideline_versions", r.error);

// Each sample's like count as likes from deterministic stand-in wallets (dev only)
const wallet = (i) => "0x" + sha(`dev-seed-wallet:${i}`).slice(0, 40);
const stars = MOCK_GUIDELINES.flatMap((g) => Array.from({ length: g.stars }, (_, i) => ({ wallet_address: wallet(i), guideline_id: seedId(g.id) })));
for (let i = 0; i < stars.length; i += 500) {
  r = await db.from("stars").upsert(stars.slice(i, i + 500), { onConflict: "wallet_address,guideline_id", ignoreDuplicates: true });
  if (r.error) fail("stars", r.error);
}

const { data: listed, error } = await db.from("listed_guidelines").select("slug, stars_count");
if (error) fail("check", error);
console.log(`db:seed: ${ref} now lists ${listed.length} guidelines with ${listed.reduce((n, g) => n + g.stars_count, 0)} likes`);
