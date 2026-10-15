// Applies web/supabase/migrations/*.sql to a Supabase project through the Management API
// (POST /v1/projects/{ref}/database/query), so schema changes don't need the SQL editor.
//
//   npm run db:migrate              development project: show pending, apply them
//   npm run db:migrate -- live      the live project (explicit, never the default)
//   npm run db:migrate -- dev --status   only list what's applied / pending
//
// Tokens (web/.env.local, never on Vercel): SUPABASE_ACCESS_TOKEN_DEV / SUPABASE_ACCESS_TOKEN_LIVE,
// scoped personal access tokens (sbp_fc…) limited to that project with Database: Read-write.
// Applied migrations are recorded in public.schema_migrations; each file runs in one transaction
// together with its record, so a failed file leaves nothing behind. Never prints the tokens.
import { readdir, readFile } from "node:fs/promises";
import { LIVE_SUPABASE_REF, readEnvLocal } from "./smoke-guard.mjs";

const DEV_SUPABASE_REF = process.env.PIKAMD_DEV_SUPABASE_REF ?? "bvtmtkkscseouplfinvj";
const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
// Run by hand in the SQL editor of both projects before this script existed (CLAUDE.md, 2026-10-14)
const APPLIED_BY_HAND = [
  "20261013000000_init.sql",
  "20261013120000_hide_lock_and_signed_nonces.sql",
  "20261014090000_publish_flow.sql",
  "20261014150000_indexer.sql",
];

const args = process.argv.slice(2);
const target = args.includes("live") ? "live" : "dev";
const statusOnly = args.includes("--status");
const ref = target === "live" ? LIVE_SUPABASE_REF : DEV_SUPABASE_REF;
const env = await readEnvLocal();
const token = target === "live" ? env.SUPABASE_ACCESS_TOKEN_LIVE : env.SUPABASE_ACCESS_TOKEN_DEV;
if (!token) {
  console.error(`db:migrate: SUPABASE_ACCESS_TOKEN_${target.toUpperCase()} is not set in web/.env.local.`);
  process.exit(2);
}

async function query(sql, { readOnly = false } = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql, read_only: readOnly }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body === "object" && "message" in body ? body.message : JSON.stringify(body);
    throw new Error(`HTTP ${res.status}: ${message}`);
  }
  return body;
}

const quote = (s) => `'${s.replaceAll("'", "''")}'`;

const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();

// Tracking table, closed to the public roles like every other object (RLS on, no policies)
await query(`
  create table if not exists public.schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  );
  alter table public.schema_migrations enable row level security;
  revoke all on public.schema_migrations from anon, authenticated;
  insert into public.schema_migrations (name)
  select unnest(array[${APPLIED_BY_HAND.map(quote).join(", ")}])
  where not exists (select 1 from public.schema_migrations)
    and to_regclass('public.indexer_state') is not null
    and exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'indexer_state' and column_name = 'updated_at');
`);

const applied = new Set((await query("select name from public.schema_migrations", { readOnly: true })).map((r) => r.name));
const pending = files.filter((f) => !applied.has(f));
console.log(`${target} project ${ref}: ${applied.size} applied, ${pending.length} pending${pending.length ? `: ${pending.join(", ")}` : ""}`);
if (statusOnly || pending.length === 0) process.exit(0);

for (const file of pending) {
  const sql = await readFile(new URL(file, MIGRATIONS), "utf8");
  try {
    await query(`begin;\n${sql}\n;insert into public.schema_migrations (name) values (${quote(file)});\ncommit;`);
    console.log(`  applied ${file}`);
  } catch (error) {
    console.error(`  FAILED ${file}: ${error.message}`);
    process.exit(1);
  }
}
