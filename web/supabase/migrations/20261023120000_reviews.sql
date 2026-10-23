-- Reviewed badge (2026-10-23, ARCHITECTURE §9.5): the index's copy of GuidelineReviews
-- (contracts/src/GuidelineReviews.sol). A moderator reads a guideline's file and approves that
-- exact version on Arc; the site shows a badge while it still holds. Arc is the truth: these
-- tables only let card lists show the badge without asking the chain once per card, and a
-- guideline's own page checks it on Arc in the browser.
--
-- A review holds when: the last event for the guideline is an approval (not a revoke), it names
-- the version the site shows and that version's content hash, no moderator has locked the
-- guideline, and the wallet that approved it hasn't lost MODERATOR_ROLE since (the contract checks
-- the role at approval time; a later RoleRevoked on the registry ends that wallet's reviews).

-- ── 1. Tables ─────────────────────────────────────────────────────────────────────────────

-- The latest review event per guideline: an approval, or a revoke (reviewed = false).
create table public.reviews (
  guideline_id  bigint      primary key check (guideline_id >= 1),
  reviewed      boolean     not null,
  version       integer     not null check (version >= 1),
  content_hash  text        check (content_hash ~ '^0x[0-9a-f]{64}$'),
  moderator     text        not null check (moderator ~ '^0x[0-9a-f]{40}$'), -- who approved or revoked
  tx_hash       text        not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  block_number  bigint      not null check (block_number >= 0),
  log_index     integer     not null check (log_index >= 0),
  recorded_at   timestamptz not null default now(),
  check (not reviewed or content_hash is not null)
);
alter table public.reviews enable row level security;

-- MODERATOR_ROLE changes seen on the registry after this table existed. No row = never revoked
-- here: the contract only takes approvals from wallets that hold the role at that moment.
create table public.moderator_roles (
  wallet        text    primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  has_role      boolean not null,
  block_number  bigint  not null check (block_number >= 0),
  log_index     integer not null check (log_index >= 0)
);
alter table public.moderator_roles enable row level security;

-- ── 2. Writers: the newest event wins, replays and out-of-order deliveries change nothing ──

create function public.apply_review(
  p_guideline_id bigint, p_reviewed boolean, p_version integer, p_content_hash text,
  p_moderator text, p_tx_hash text, p_block_number bigint, p_log_index integer
) returns boolean
language plpgsql
set search_path = public
as $$
begin
  insert into reviews as r (guideline_id, reviewed, version, content_hash, moderator, tx_hash, block_number, log_index)
  values (p_guideline_id, p_reviewed, p_version, lower(p_content_hash), lower(p_moderator), lower(p_tx_hash), p_block_number, p_log_index)
  on conflict (guideline_id) do update
    set reviewed = excluded.reviewed, version = excluded.version, content_hash = excluded.content_hash,
        moderator = excluded.moderator, tx_hash = excluded.tx_hash, block_number = excluded.block_number,
        log_index = excluded.log_index, recorded_at = now()
    where (r.block_number, r.log_index) < (excluded.block_number, excluded.log_index);
  return found;
end;
$$;

create function public.apply_moderator_role(p_wallet text, p_has_role boolean, p_block_number bigint, p_log_index integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  insert into moderator_roles as m (wallet, has_role, block_number, log_index)
  values (lower(p_wallet), p_has_role, p_block_number, p_log_index)
  on conflict (wallet) do update
    set has_role = excluded.has_role, block_number = excluded.block_number, log_index = excluded.log_index
    where (m.block_number, m.log_index) < (excluded.block_number, excluded.log_index);
  return found;
end;
$$;

-- ── 3. Does the review still hold for the version the site shows? ─────────────────────────

create function public.review_holds(p_guideline_id bigint, p_version integer, p_content_hash text, p_locked boolean)
returns boolean
language sql
stable
set search_path = public
as $$
  select not p_locked and exists (
    select 1 from reviews r
    where r.guideline_id = p_guideline_id
      and r.reviewed
      and r.version = p_version
      and r.content_hash = lower(p_content_hash)
      and not exists (select 1 from moderator_roles m where m.wallet = r.moderator and not m.has_role)
  );
$$;

-- ── 4. Listings carry it ──────────────────────────────────────────────────────────────────

create or replace view public.listed_guidelines
with (security_invoker = true) as
select g.*, v.cid, v.content_hash, v.content, v.scan_status,
       (select count(*) from stars s where s.guideline_id = g.id and s.removed_at is null)::integer as stars_count,
       public.review_holds(g.id, g.latest_version, v.content_hash, g.moderator_locked) as reviewed
from guidelines g
join guideline_versions v on v.guideline_id = g.id and v.version = g.latest_version
where not g.author_hidden and not g.moderator_locked;

drop function public.author_guidelines(text);
create function public.author_guidelines(p_wallet text)
returns table (
  id bigint, slug text, author_address text, title text, description text, kind text, tags text[],
  license smallint, latest_version integer, uses_count integer, stars_count integer,
  scan_status text, cid text, content_hash text, tx_hash text,
  author_hidden boolean, moderator_locked boolean, reviewed boolean
)
language sql
stable
set search_path = public
as $$
  select g.id, g.slug, g.author_address, g.title, g.description, g.kind, g.tags,
         g.license, g.latest_version, g.uses_count,
         (select count(*) from stars s where s.guideline_id = g.id and s.removed_at is null)::integer,
         v.scan_status, v.cid, v.content_hash, g.tx_hash,
         g.author_hidden, g.moderator_locked,
         public.review_holds(g.id, g.latest_version, v.content_hash, g.moderator_locked)
  from guidelines g
  join guideline_versions v on v.guideline_id = g.id and v.version = g.latest_version
  where g.author_address = lower(p_wallet)
  order by g.block_number desc, g.id desc;
$$;

-- ── 5. The moderation log records approvals and revokes too ───────────────────────────────

alter table public.moderation_log
  drop constraint moderation_log_action_check,
  add constraint moderation_log_action_check check (action in ('lock', 'unlock', 'dismiss', 'approve', 'unpin', 'review', 'unreview'));

-- ── Privileges: the same closed model as every other object (server only) ─────────────────

revoke all on public.reviews, public.moderator_roles from anon, authenticated;
grant all on public.reviews, public.moderator_roles to service_role;
revoke all on public.listed_guidelines from anon, authenticated;
grant all on public.listed_guidelines to service_role;
revoke all on function public.apply_review(bigint, boolean, integer, text, text, text, bigint, integer) from public, anon, authenticated;
revoke all on function public.apply_moderator_role(text, boolean, bigint, integer) from public, anon, authenticated;
revoke all on function public.review_holds(bigint, integer, text, boolean) from public, anon, authenticated;
revoke all on function public.author_guidelines(text) from public, anon, authenticated;
grant execute on function public.apply_review(bigint, boolean, integer, text, text, text, bigint, integer) to service_role;
grant execute on function public.apply_moderator_role(text, boolean, bigint, integer) to service_role;
grant execute on function public.review_holds(bigint, integer, text, boolean) to service_role;
grant execute on function public.author_guidelines(text) to service_role;
