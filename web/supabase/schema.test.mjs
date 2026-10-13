// Runs the Supabase migration on a real Postgres (PGlite, WASM) and checks the rules it enforces:
// public roles get nothing, nonces are single use, likes are one per wallet and permanent,
// hidden guidelines don't count, PikaGold is computed from likes.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = new URL("./migrations/", import.meta.url);
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
  // Every migration, in file name order, exactly as they run in the Supabase SQL editor
  for (const file of (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, MIGRATIONS), "utf8"));
  }
  await addGuideline(1, "secure-solidity", A);
  await addGuideline(2, "tailwind-v4", B);
});

async function addGuideline(id, slug, author, { scan = "clean", hidden = false, locked = false } = {}) {
  await db.query(
    `insert into guidelines (id, slug, author_address, title, description, kind, tags, license, latest_version, author_hidden, moderator_locked, tx_hash, block_number)
     values ($1, $2, $3, $4, 'd', 'rules', '{a}', 0, 1, $5, $6, $7, 1)`,
    [id, slug, author, slug, hidden, locked, hex64(String(id % 10))],
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
  await assert.rejects(asRole("authenticated", `select use_nonce('${"0".repeat(48)}', now() + interval '5 minutes')`), /permission denied/);
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

test("a used nonce can't be used again; expired ones are cleared", async () => {
  const n = "1".repeat(48);
  const use = async (nonce, exp = "now() + interval '5 minutes'") =>
    (await db.query(`select use_nonce($1, ${exp}) as ok`, [nonce])).rows[0].ok;
  assert.equal(await use(n), true, "first use");
  assert.equal(await use(n), false, "replay");

  const old = "3".repeat(48);
  await db.query(`insert into auth_nonces values ($1, now() - interval '1 second')`, [old]);
  await use("4".repeat(48));
  assert.equal((await db.query(`select count(*)::int as c from auth_nonces where nonce = $1`, [old])).rows[0].c, 0, "expired row cleared");
  await db.query(`delete from auth_nonces`);
});

test("the old store-on-issue nonce functions are gone", async () => {
  await assert.rejects(db.query(`select save_nonce('${"1".repeat(32)}', now(), 10)`), /does not exist/);
  await assert.rejects(db.query(`select consume_nonce('${"1".repeat(32)}')`), /does not exist/);
  await assert.rejects(db.query(`insert into auth_nonces values ($1, now())`, ["1".repeat(32)]), /check constraint/, "old 32-hex format");
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

test("unknown, hidden, locked and suspicious guidelines can't be liked and don't count", async () => {
  await addGuideline(3, "hidden", A, { hidden: true });
  await addGuideline(4, "flagged", A, { scan: "suspicious" });
  await addGuideline(5, "locked", A, { locked: true });
  for (const slug of ["nope", "hidden", "flagged", "locked"]) {
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
