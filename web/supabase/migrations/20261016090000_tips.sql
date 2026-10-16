-- Tips to authors (K21, 2026-10-16). Applied with `npm run db:migrate`.
--
-- The USDC itself moves on Arc, wallet to wallet, through GuidelineTips (contracts/src/GuidelineTips.sol).
-- This table is only the index's copy of its Tipped events, so the site can show an author what they
-- received: one row per event (tx_hash, log_index), written by POST /api/tips/record right after a
-- tip and by the indexer later; writing the same event again changes nothing.
-- guideline_id has no foreign key on purpose: the contract accepts any listed guideline in the
-- registry, published on this site or not, and the index must never drop a tip that happened.
--
-- 1. tips
-- 2. wallet_profile also returns the tips a wallet received (total in USDC units, count)

create table public.tips (
  tx_hash        text           not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index      integer        not null check (log_index >= 0),
  block_number   bigint         not null check (block_number > 0),
  guideline_id   bigint         not null check (guideline_id > 0),
  from_address   text           not null check (from_address ~ '^0x[0-9a-f]{40}$'),
  author_address text           not null check (author_address ~ '^0x[0-9a-f]{40}$'),
  -- USDC units (6 decimals) as the event has them; GuidelineTips.MIN_TIP is 10,000 (0.01 USDC)
  amount         numeric(78, 0) not null check (amount >= 10000),
  recorded_at    timestamptz    not null default now(),
  primary key (tx_hash, log_index),
  check (from_address <> author_address)
);
create index tips_author_idx on public.tips (author_address);
create index tips_guideline_idx on public.tips (guideline_id);
alter table public.tips enable row level security;

-- ── 2. Profile: PikaGold as before, plus tips received ────────────────────────────────────
-- The return type grows, so the function is replaced (the server reads columns by name).

drop function public.wallet_profile(text);
create function public.wallet_profile(p_wallet text)
returns table (pikagold integer, guidelines integer, tips_received text, tips_count integer)
language sql stable
set search_path = public
as $$
  select
    (select count(*) from stars s join listed_guidelines g on g.id = s.guideline_id
     where g.author_address = lower(p_wallet))::integer,
    (select count(*) from listed_guidelines where author_address = lower(p_wallet))::integer,
    (select coalesce(sum(amount), 0) from tips where author_address = lower(p_wallet))::text,
    (select count(*) from tips where author_address = lower(p_wallet))::integer;
$$;

-- ── Privileges: same closed model as every other object ───────────────────────────────────

revoke all on public.tips from anon, authenticated;
grant all on public.tips to service_role;
revoke all on function public.wallet_profile(text) from public, anon, authenticated;
grant execute on function public.wallet_profile(text) to service_role;
