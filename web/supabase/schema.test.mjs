// Runs the Supabase migration on a real Postgres (PGlite, WASM) and checks the rules it enforces:
// public roles get nothing, nonces are single use, a wallet's first like on a guideline earns its
// author 1 PikaGold that unliking never takes back, hidden guidelines don't count.
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
  await assert.rejects(asRole("anon", `select * from remove_like($1, 'secure-solidity')`, [A]), /permission denied/);
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

test("one like per wallet per guideline, wallet stored lowercase", async () => {
  const first = (await db.query(`select * from add_like($1, 'secure-solidity')`, [B.toUpperCase().replace("0X", "0x")])).rows[0];
  assert.deepEqual(first, { created: true, restored: false, like_count: 1 });
  const again = (await db.query(`select * from add_like($1, 'secure-solidity')`, [B])).rows[0];
  assert.deepEqual(again, { created: false, restored: false, like_count: 1 });
  const mine = (await db.query(`select * from liked_slugs($1)`, [B])).rows.map((r) => r.liked_slugs);
  assert.deepEqual(mine, ["secure-solidity"]);
});

test("authors can like their own guideline and earn PikaGold for it", async () => {
  await db.query(`select * from add_like($1, 'secure-solidity')`, [A]);
  const p = (await db.query(`select * from wallet_profile($1)`, [A])).rows[0];
  assert.deepEqual(p, { pikagold: 2, guidelines: 1, tips_received: "0", tips_count: 0 });
  const counts = Object.fromEntries((await db.query(`select * from like_counts()`)).rows.map((r) => [r.slug, r.like_count]));
  assert.equal(counts["secure-solidity"], 2);
  assert.equal(counts["tailwind-v4"], 0);
});

test("unknown, hidden and locked guidelines can't be liked and don't count", async () => {
  await addGuideline(3, "hidden", A, { hidden: true });
  await addGuideline(5, "locked", A, { locked: true });
  for (const slug of ["nope", "hidden", "locked"]) {
    await assert.rejects(db.query(`select * from add_like($1, $2)`, [B, slug]), /unknown guideline/, slug);
  }
  await db.query(`insert into stars (wallet_address, guideline_id) values ($1, 3)`, [B]); // liked before it was hidden
  const p = (await db.query(`select * from wallet_profile($1)`, [A])).rows[0];
  assert.deepEqual(p, { pikagold: 2, guidelines: 1, tips_received: "0", tips_count: 0 }, "hidden guideline's likes don't count");
  const slugs = (await db.query(`select slug from like_counts()`)).rows.map((r) => r.slug).sort();
  assert.deepEqual(slugs, ["secure-solidity", "tailwind-v4"]);
});

test("unliking keeps the author's PikaGold, and liking again earns none", async () => {
  const gold = async () => (await db.query(`select * from wallet_profile($1)`, [A])).rows[0].pikagold;
  const count = async () => (await db.query(`select * from like_counts()`)).rows.find((r) => r.slug === "secure-solidity").like_count;
  const mine = async () => (await db.query(`select * from liked_slugs($1)`, [B])).rows.map((r) => r.liked_slugs);
  assert.equal(await gold(), 2);

  const removed = (await db.query(`select * from remove_like($1, 'secure-solidity')`, [B.toUpperCase().replace("0X", "0x")])).rows[0];
  assert.deepEqual(removed, { removed: true, like_count: 1 });
  assert.equal(await count(), 1, "the shown count drops");
  assert.deepEqual(await mine(), [], "no longer in my likes");
  assert.equal(await gold(), 2, "the author keeps the PikaGold");
  const twice = (await db.query(`select * from remove_like($1, 'secure-solidity')`, [B])).rows[0];
  assert.deepEqual(twice, { removed: false, like_count: 1 });

  const back = (await db.query(`select * from add_like($1, 'secure-solidity')`, [B])).rows[0];
  assert.deepEqual(back, { created: false, restored: true, like_count: 2 });
  assert.deepEqual(await mine(), ["secure-solidity"]);
  assert.equal(await gold(), 2, "liking again earns no second PikaGold");

  const never = (await db.query(`select * from remove_like($1, 'tailwind-v4')`, [B])).rows[0];
  assert.deepEqual(never, { removed: false, like_count: 0 }, "nothing to take back");
  await assert.rejects(db.query(`select * from remove_like($1, 'nope')`, [B]), /unknown guideline/);
  assert.equal((await db.query(`select count(*)::int as n from stars where wallet_address = $1`, [B])).rows[0].n, 2, "rows are never deleted");
});

test("flagged (suspicious) guidelines stay listed with their scan status, for the site; MCP filters them", async () => {
  await addGuideline(4, "flagged", B, { scan: "suspicious" });
  const row = (await db.query(`select slug, scan_status from listed_guidelines where id = 4`)).rows[0];
  assert.deepEqual(row, { slug: "flagged", scan_status: "suspicious" });
  await db.query(`delete from guideline_versions where guideline_id = 4`);
  await db.query(`delete from guidelines where id = 4`);
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

// ── Publish flow: prepare_upload / confirm_guideline ──

const prep = (wallet, slug, cid, hash, { ttl = 3600, meta } = {}) =>
  db.query(`select prepare_upload($1, $2, $3, 'pin-id', $4, '# body', $5::jsonb, 'clean', '{}'::jsonb, $6) as r`, [
    wallet, slug, cid, hash, JSON.stringify(meta ?? { title: "Published One", description: "A sample summary", kind: "skill", tags: ["x", "y"] }), ttl,
  ]).then((r) => r.rows[0].r);
const confirm = (wallet, id, cid, hash) =>
  db.query(`select confirm_guideline($1, $2, $3, $4, 0, 0::smallint, $5, 7, 3) as slug`, [wallet, id, cid, hash, "0x" + String(id).padStart(64, "e")]).then((r) => r.rows[0].slug);

test("prepare_upload reserves a free slug and refuses taken ones", async () => {
  assert.equal(await prep(A, "secure-solidity", "bafy1", hex64("1")), "slug_taken", "an existing guideline's slug");
  assert.equal(await prep(A, "fresh-one", "bafy1", hex64("1")), "ok");
  assert.equal(await prep(B, "fresh-one", "bafy2", hex64("2")), "slug_taken", "reserved by another wallet");
  assert.equal(await prep(A, "fresh-one", "bafy3", hex64("3")), "ok", "the same wallet may prepare again");
  const rows = (await db.query(`select cid from pending_uploads where slug = 'fresh-one'`)).rows;
  assert.deepEqual(rows, [{ cid: "bafy3" }], "its earlier reservation is replaced");
  await db.query(`update pending_uploads set expires_at = now() - interval '1 second'`);
  assert.equal(await prep(B, "fresh-one", "bafy2", hex64("2")), "ok", "an expired reservation frees the slug");
  await db.query(`delete from pending_uploads`);
});

test("confirm_guideline turns the wallet's matching upload into version 1, once", async () => {
  await prep(A, "published-one", "bafyP", hex64("4"));
  await assert.rejects(confirm(B, 10, "bafyP", hex64("4")), /no matching upload/, "another wallet");
  await assert.rejects(confirm(A, 10, "bafyOTHER", hex64("4")), /no matching upload/, "another CID");
  await assert.rejects(confirm(A, 10, "bafyP", hex64("5")), /no matching upload/, "another hash");
  assert.equal(await confirm(A, 10, "bafyP", hex64("4")), "published-one");
  const g = (await db.query(`select slug, author_address, title, kind, tags, latest_version, parent_id from guidelines where id = 10`)).rows[0];
  assert.deepEqual(g, { slug: "published-one", author_address: A, title: "Published One", kind: "skill", tags: ["x", "y"], latest_version: 1, parent_id: null });
  const v = (await db.query(`select version, cid, content, block_number, log_index from guideline_versions where guideline_id = 10`)).rows[0];
  assert.deepEqual(v, { version: 1, cid: "bafyP", content: "# body", block_number: 7, log_index: 3 });
  assert.equal((await db.query(`select count(*)::int as c from pending_uploads`)).rows[0].c, 0, "reservation used up");
  assert.equal(await confirm(A, 10, "bafyP", hex64("4")), "published-one", "confirming again is harmless");
  assert.ok((await db.query(`select 1 from listed_guidelines where slug = 'published-one'`)).rows.length === 1, "listed");
});

test("public roles can't call the publish functions", async () => {
  await assert.rejects(asRole("anon", `select prepare_upload('a','b','c','d','e','f','{}'::jsonb,'clean','{}'::jsonb,1)`), /permission denied/);
  await assert.rejects(asRole("authenticated", `select confirm_guideline('a',1,'c','d',0,0::smallint,'t',1,1)`), /permission denied/);
});

// ── Indexer ──

test("claim_indexer gives one sync turn at a time and save_indexer never moves backwards", async () => {
  const claim = (min = 120) => db.query(`select claim_indexer('reg:test', 99, $1) as b`, [min]).then((r) => r.rows[0].b);
  assert.equal(await claim(), 99, "first claim starts at p_start");
  assert.equal(await claim(), null, "a second claim right away gets nothing");
  await db.query(`select save_indexer('reg:test', 500)`);
  await db.query(`select save_indexer('reg:test', 300)`);
  assert.equal((await db.query(`select last_block from indexer_state where key = 'reg:test'`)).rows[0].last_block, 500, "never backwards");
  await db.query(`update indexer_state set updated_at = now() - interval '10 minutes' where key = 'reg:test'`);
  assert.equal(await claim(), 500, "after the interval the next sync resumes from the saved block");
  await assert.rejects(asRole("anon", `select claim_indexer('x', 1, 1)`), /permission denied/);
});

test("confirming keeps the Pinata file id for later unpinning", async () => {
  await prep(B, "pinned-one", "bafyQ", hex64("6"));
  await confirm(B, 11, "bafyQ", hex64("6"));
  assert.equal((await db.query(`select pinata_id from guideline_versions where guideline_id = 11`)).rows[0].pinata_id, "pin-id");
});

// ── Publish hardening (security review 2026-10-15) ──

const confirmWithParent = (wallet, id, cid, hash, parent) =>
  db.query(`select confirm_guideline($1, $2, $3, $4, $5, 0::smallint, $6, 8, 1) as slug`, [wallet, id, cid, hash, parent, "0x" + String(id).padStart(64, "d")]).then((r) => r.rows[0].slug);

test("a parent the index doesn't know can't fail a confirm (and stall the indexer)", async () => {
  await prep(A, "child-of-unknown", "bafyC1", hex64("7"));
  assert.equal(await confirmWithParent(A, 20, "bafyC1", hex64("7"), 777777), "child-of-unknown");
  assert.equal((await db.query(`select parent_id from guidelines where id = 20`)).rows[0].parent_id, null, "unknown parent stored as none");
  await prep(A, "child-of-known", "bafyC2", hex64("8"));
  assert.equal(await confirmWithParent(A, 21, "bafyC2", hex64("8"), 20), "child-of-known");
  assert.equal((await db.query(`select parent_id from guidelines where id = 21`)).rows[0].parent_id, 20, "a known parent is kept");
});

test("a wallet can hold at most 5 unfinished uploads; re-preparing its own doesn't count", async () => {
  const W = "0x" + "c".repeat(40);
  for (let i = 1; i <= 5; i++) assert.equal(await prep(W, `limit-${i}`, `bafyL${i}`, hex64(String(i))), "ok");
  assert.equal(await prep(W, "limit-6", "bafyL6", hex64("6")), "too_many");
  assert.equal(await prep(W, "limit-3", "bafyL3b", hex64("9")), "ok", "same name replaces its own upload");
  assert.equal(await prep(W, "limit-x", "bafyL1", hex64("1")), "ok", "same file replaces its own upload");
  const check = (bytes) => db.query(`select prepare_check($1, 'limit-7', $2, $3) as r`, [W, hex64("a"), bytes]).then((r) => r.rows[0].r);
  assert.equal(await check(10), "too_many", "prepare_check answers the same before pinning");
  await db.query(`update pending_uploads set expires_at = now() - interval '1 second' where wallet_address = $1`, [W]);
  assert.equal(await check(10), "ok", "expired uploads don't count");
  assert.equal(await check(101 * 1024 * 1024), "busy", "100 MB of unfinished uploads in all");
  await db.query(`delete from pending_uploads`);
});

test("scan reports stay small", async () => {
  const big = JSON.stringify({ findings: Array.from({ length: 3000 }, (_, i) => ({ rule: "email", severity: "personal", line: i })) });
  await assert.rejects(
    db.query(`select prepare_upload($1, 'big-report', 'bafyR', 'pin', $2, '# x', '{"title":"Big","description":"A sample summary","kind":"rules","tags":[]}'::jsonb, 'clean', $3::jsonb, 60)`, [A, hex64("b"), big]),
    /scan_report_size/,
  );
  await assert.rejects(asRole("anon", `select prepare_check('a','b','c',1)`), /permission denied/);
});

test("rate_limit counts hits in a fixed window and starts over after it", async () => {
  const hit = () => db.query(`select rate_limit('verify:abc', 3, 600) as ok`).then((r) => r.rows[0].ok);
  assert.deepEqual([await hit(), await hit(), await hit(), await hit()], [true, true, true, false]);
  await db.query(`update rate_limits set window_start = now() - interval '11 minutes' where key = 'verify:abc'`);
  assert.equal(await hit(), true, "a new window");
  assert.equal((await db.query(`select hits from rate_limits where key = 'verify:abc'`)).rows[0].hits, 1);
  assert.equal(await db.query(`select rate_limit('verify:other', 3, 600) as ok`).then((r) => r.rows[0].ok), true, "keys are separate");
  await assert.rejects(asRole("anon", `select rate_limit('x', 1, 1)`), /permission denied/);
  await assert.rejects(asRole("anon", `select * from rate_limits`), /permission denied/);
});

test("author_guidelines lists the wallet's own guidelines, hidden and locked ones too, and nobody else's", async () => {
  const C = "0x" + "c".repeat(40);
  await addGuideline(31, "c-listed", C);
  await addGuideline(32, "c-hidden", C, { hidden: true });
  await addGuideline(33, "c-locked", C, { locked: true, scan: "suspicious" });
  await db.query(`update guidelines set block_number = id where id in (31, 32, 33)`);
  const rows = (await asRole("service_role", `select * from author_guidelines($1)`, [C.toUpperCase().replace("0X", "0x")])).rows;
  assert.deepEqual(rows.map((r) => r.slug), ["c-locked", "c-hidden", "c-listed"], "newest first, mixed-case wallet accepted");
  assert.deepEqual(rows.map((r) => [r.author_hidden, r.moderator_locked]), [[false, true], [true, false], [false, false]]);
  assert.equal(rows[0].scan_status, "suspicious");
  assert.ok(!("content" in rows[0]), "no file content");
  assert.equal((await db.query(`select * from author_guidelines($1)`, [A])).rows.every((r) => r.author_address === A), true);
  const listed = (await db.query(`select slug from listed_guidelines where author_address = $1`, [C])).rows.map((r) => r.slug);
  assert.deepEqual(listed, ["c-listed"], "the public list still hides them");
  await assert.rejects(asRole("anon", `select * from author_guidelines($1)`, [C]), /permission denied/);
  await assert.rejects(asRole("authenticated", `select * from author_guidelines($1)`, [C]), /permission denied/);
});

// ── Tips (K21): the index's copy of GuidelineTips' Tipped events ──

const tip = (tx, logIndex, { guideline = 1, from = B, author = A, amount = "3000000", block = 5 } = {}) =>
  db.query(
    `insert into tips (tx_hash, log_index, block_number, guideline_id, from_address, author_address, amount)
     values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing`,
    [hex64(tx), logIndex, block, guideline, from, author, amount],
  );

test("each Tipped event is stored once; malformed rows are refused", async () => {
  await tip("1", 0);
  await tip("1", 0, { amount: "999000000" }); // the same event again (a retry, the indexer): no change
  const rows = (await db.query(`select amount::text from tips where tx_hash = $1`, [hex64("1")])).rows;
  assert.deepEqual(rows, [{ amount: "3000000" }]);
  for (const bad of [
    { amount: "9999" }, // under GuidelineTips.MIN_TIP
    { from: A, author: A }, // the contract refuses self tips
    { from: "0xABC" },
    { author: B.toUpperCase().replace("0X", "0x") }, // stored lowercase only
    { guideline: 0 },
    { block: 0 },
  ]) {
    await assert.rejects(tip("2", 9, bad), /violates check constraint/, JSON.stringify(bad));
  }
  await assert.rejects(tip("2", -1), /violates check constraint/);
  await assert.rejects(db.query(`insert into tips (tx_hash, log_index, block_number, guideline_id, from_address, author_address, amount) values ('0x12', 0, 1, 1, $1, $2, 10000)`, [B, A]), /violates check constraint/);
});

test("wallet_profile adds up the tips a wallet received, exactly, and no one else's", async () => {
  const C = "0x" + "c".repeat(40);
  const D = "0x" + "d".repeat(40);
  await tip("3", 0, { author: C, from: A, amount: "1000000" });
  await tip("3", 1, { author: C, from: B, amount: "2500000", guideline: 77 }); // a guideline the index doesn't know
  await tip("4", 0, { author: C, from: D, amount: "123456789012345678901" }); // far beyond 2^53
  await tip("4", 1, { author: D, from: C, amount: "10000" });
  const [row] = (await asRole("service_role", `select * from wallet_profile($1)`, [C.toUpperCase().replace("0X", "0x")])).rows;
  assert.equal(row.tips_received, "123456789012349178901", "1 + 2.5 USDC + the huge one, no rounding");
  assert.equal(row.tips_count, 3);
  const [none] = (await db.query(`select * from wallet_profile($1)`, ["0x" + "e".repeat(40)])).rows;
  assert.deepEqual([none.tips_received, none.tips_count, none.pikagold, none.guidelines], ["0", 0, 0, 0]);
  const [author] = (await db.query(`select * from wallet_profile($1)`, [A])).rows;
  assert.equal(typeof author.pikagold, "number", "PikaGold still there");
});

test("public roles can't read or write tips", async () => {
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(asRole(role, `select * from tips`), /permission denied/);
    await assert.rejects(
      asRole(role, `insert into tips (tx_hash, log_index, block_number, guideline_id, from_address, author_address, amount) values ($1, 0, 1, 1, $2, $3, 10000)`, [hex64("9"), B, A]),
      /permission denied/,
    );
  }
  const r = await asRole("service_role", `select count(*)::int as n from tips`);
  assert.ok(r.rows[0].n >= 1);
});
