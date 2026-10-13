// Runs the Supabase migration on a real Postgres (PGlite, WASM) and checks the rules it enforces:
// public roles get nothing, nonces are single use, likes are one per wallet and permanent,
// hidden guidelines don't count, PikaGold is computed from likes.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = new URL("./migrations/20261013000000_init.sql", import.meta.url);
const A = "0x" + "a".repeat(40);
const B = "0x" + "b".repeat(40);
const hex64 = (c) => "0x" + c.repeat(64);

let db;

before(async () => {
  db = new PGlite();
  // Roles Supabase creates for every project
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`);
  // Supabase grants the public roles access to the public schema; the migration must close it
  await db.exec(`grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;`);
  await db.exec(await readFile(MIGRATION, "utf8"));
  await addGuideline(1, "secure-solidity", A);
  await addGuideline(2, "tailwind-v4", B);
});

async function addGuideline(id, slug, author, { scan = "clean", delisted = false } = {}) {
  await db.query(
    `insert into guidelines (id, slug, author_address, title, description, kind, tags, license, latest_version, delisted, tx_hash, block_number)
     values ($1, $2, $3, $4, 'd', 'rules', '{a}', 0, 1, $5, $6, 1)`,
    [id, slug, author, slug, delisted, hex64(String(id % 10))],
  );
  await db.query(
    `insert into guideline_versions (guideline_id, version, cid, content_hash, content, scan_status, tx_hash, block_number, log_index)
     values ($1, 1, 'bafy', $2, '# hi', $3, $4, 1, $5)`,
    [id, hex64("c"), scan, hex64(String(id % 10)), id],
  );
}

const asRole = async (role, sql, params = []) => {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
};

test("public roles can't read tables or views", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (const rel of ["guidelines", "stars", "mcp_keys", "auth_nonces", "listed_guidelines"]) {
      await assert.rejects(asRole(role, `select * from ${rel}`), /permission denied/, `${role} reads ${rel}`);
    }
  }
});

test("public roles can't call the functions (no /rpc writes with the publishable key)", async () => {
  await assert.rejects(asRole("anon", `select * from add_like($1, 'secure-solidity')`, [A]), /permission denied/);
  await assert.rejects(asRole("authenticated", `select save_nonce('${"0".repeat(32)}', now() + interval '5 minutes', 10)`), /permission denied/);
  await assert.rejects(asRole("anon", `select * from wallet_profile($1)`, [A]), /permission denied/);
});

test("service_role can use everything", async () => {
  const r = await asRole("service_role", `select * from wallet_profile($1)`, [A]);
  assert.equal(r.rows.length, 1);
});

test("objects created later start closed to public roles", async () => {
  await db.exec(`create table public.later (x int)`);
  await assert.rejects(asRole("anon", `select * from later`), /permission denied/);
  await db.exec(`drop table public.later`);
});

test("nonces are single use and expire", async () => {
  const n = "1".repeat(32);
  assert.equal((await db.query(`select save_nonce($1, now() + interval '5 minutes', 100) as ok`, [n])).rows[0].ok, true);
  assert.equal((await db.query(`select consume_nonce($1) as ok`, [n])).rows[0].ok, true);
  assert.equal((await db.query(`select consume_nonce($1) as ok`, [n])).rows[0].ok, false, "second use");
  assert.equal((await db.query(`select consume_nonce($1) as ok`, ["2".repeat(32)])).rows[0].ok, false, "unknown");

  const old = "3".repeat(32);
  await db.query(`insert into auth_nonces values ($1, now() - interval '1 second')`, [old]);
  assert.equal((await db.query(`select consume_nonce($1) as ok`, [old])).rows[0].ok, false, "expired");
  assert.equal((await db.query(`select count(*)::int as c from auth_nonces where nonce = $1`, [old])).rows[0].c, 0, "expired row is gone");
});

test("too many pending nonces are refused", async () => {
  await db.query(`delete from auth_nonces`);
  assert.equal((await db.query(`select save_nonce($1, now() + interval '5 minutes', 1) as ok`, ["4".repeat(32)])).rows[0].ok, true);
  assert.equal((await db.query(`select save_nonce($1, now() + interval '5 minutes', 1) as ok`, ["5".repeat(32)])).rows[0].ok, false);
  await db.query(`delete from auth_nonces`);
});

test("one permanent like per wallet per guideline, wallet stored lowercase", async () => {
  const first = (await db.query(`select * from add_like($1, 'secure-solidity')`, [B.toUpperCase().replace("0X", "0x")])).rows[0];
  assert.deepEqual(first, { created: true, like_count: 1 });
  const again = (await db.query(`select * from add_like($1, 'secure-solidity')`, [B])).rows[0];
  assert.deepEqual(again, { created: false, like_count: 1 });
  const mine = (await db.query(`select * from liked_slugs($1)`, [B])).rows.map((r) => r.liked_slugs);
  assert.deepEqual(mine, ["secure-solidity"]);
});

test("authors can like their own guideline and earn PikaGold for it", async () => {
  await db.query(`select * from add_like($1, 'secure-solidity')`, [A]);
  const p = (await db.query(`select * from wallet_profile($1)`, [A])).rows[0];
  assert.deepEqual(p, { pikagold: 2, guidelines: 1 });
  const counts = Object.fromEntries((await db.query(`select * from like_counts()`)).rows.map((r) => [r.slug, r.like_count]));
  assert.equal(counts["secure-solidity"], 2);
  assert.equal(counts["tailwind-v4"], 0);
});

test("unknown, delisted and suspicious guidelines can't be liked and don't count", async () => {
  await addGuideline(3, "hidden", A, { delisted: true });
  await addGuideline(4, "flagged", A, { scan: "suspicious" });
  for (const slug of ["nope", "hidden", "flagged"]) {
    await assert.rejects(db.query(`select * from add_like($1, $2)`, [B, slug]), /unknown guideline/, slug);
  }
  await db.query(`insert into stars (wallet_address, guideline_id) values ($1, 3)`, [B]); // liked before it was hidden
  const p = (await db.query(`select * from wallet_profile($1)`, [A])).rows[0];
  assert.deepEqual(p, { pikagold: 2, guidelines: 1 }, "hidden guideline's likes don't count");
  const slugs = (await db.query(`select slug from like_counts()`)).rows.map((r) => r.slug).sort();
  assert.deepEqual(slugs, ["secure-solidity", "tailwind-v4"]);
});

test("constraints reject malformed data", async () => {
  await assert.rejects(db.query(`insert into stars values ('0xABC', 1)`), /check constraint/);
  await assert.rejects(db.query(`insert into auth_nonces values ('short', now())`), /check constraint/);
  await assert.rejects(addGuideline(9, "Bad Slug", A), /check constraint/);
  await db.query(`insert into mcp_keys (key_hash, wallet_address, masked) values ($1, $2, 'pmd_1…1')`, ["d".repeat(64), A]);
  await assert.rejects(
    db.query(`insert into mcp_keys (key_hash, wallet_address, masked) values ($1, $2, 'pmd_2…2')`, ["e".repeat(64), A]),
    /duplicate key/,
    "one active key per wallet",
  );
});
