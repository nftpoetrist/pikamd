-- A moderator can delete a guideline from PikaMd for good (2026-10-26, user decision).
--
-- Hiding (the author) and locking (a moderator) stay as they are: both can be undone. Deleting is
-- a third, moderator-only step for a guideline that is already off the site (hidden or locked on
-- Arc): its rows, its cached text and everything pointing at it go, so it no longer exists
-- anywhere on PikaMd, not even under its author's "Shared by me". The server removes the IPFS
-- files first (purge_files decides which are safe), then calls purge_guideline.
-- The Arc record (author, CID, hash) can't be deleted: nothing on a blockchain can.
--
-- 1. purged_guidelines: the deleted ids only, so no path (the indexer, a replayed confirm with the
--    old transaction) can index one again. Nothing else about the guideline is kept.
-- 2. pikagold_kept: PikaGold earned on a deleted guideline stays with its author (the 2026-10-23
--    rule: earned PikaGold doesn't go away when a guideline leaves the site), unless it was locked.
-- 3. purge_files, purge_guideline; wallet_profile counts pikagold_kept.

-- ── 1. Deleted ids ────────────────────────────────────────────────────────────────────────

create table public.purged_guidelines (
  id        bigint primary key check (id >= 1),
  purged_at timestamptz not null default now()
);
alter table public.purged_guidelines enable row level security;

-- A constraint error (23xxx): the indexer and the publish confirm skip it instead of retrying
create function public.refuse_purged_guideline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from purged_guidelines where id = new.id) then
    raise exception 'guideline % was deleted from PikaMd', new.id using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guidelines_refuse_purged
before insert on public.guidelines
for each row execute function public.refuse_purged_guideline();

-- ── 2. PikaGold that outlives a deleted guideline ─────────────────────────────────────────

create table public.pikagold_kept (
  wallet_address text primary key check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  amount         integer not null check (amount >= 0)
);
alter table public.pikagold_kept enable row level security;

create or replace function public.wallet_profile(p_wallet text)
returns table (pikagold integer, guidelines integer, tips_received text, tips_count integer)
language sql stable
set search_path = public
as $$
  select
    ((select count(*) from stars s join guidelines g on g.id = s.guideline_id
      where g.author_address = lower(p_wallet) and not g.moderator_locked)
     + coalesce((select amount from pikagold_kept where wallet_address = lower(p_wallet)), 0))::integer,
    (select count(*) from listed_guidelines where author_address = lower(p_wallet))::integer,
    (select coalesce(sum(amount), 0) from tips where author_address = lower(p_wallet))::text,
    (select count(*) from tips where author_address = lower(p_wallet))::integer;
$$;

-- ── 3. Deleting ───────────────────────────────────────────────────────────────────────────

-- The Pinata files of this guideline that nothing else on PikaMd uses: no other guideline (hidden
-- and locked ones included, they can come back) and no pending upload. Pinata gives the same file
-- id to the same content, so a shared file stays until its last user is deleted.
create function public.purge_files(p_guideline_id bigint)
returns table (pinata_id text)
language sql stable
set search_path = public
as $$
  select distinct v.pinata_id from guideline_versions v
  where v.guideline_id = p_guideline_id and v.pinata_id is not null
    and not exists (select 1 from guideline_versions o where o.pinata_id = v.pinata_id and o.guideline_id <> p_guideline_id)
    and not exists (select 1 from pending_uploads p where p.pinata_id = v.pinata_id);
$$;

-- Deletes the guideline and everything about it. The flags are the ones the server just read from
-- Arc; a guideline that is still listed there is refused (PM002). False: not in the index.
create function public.purge_guideline(p_guideline_id bigint, p_hidden boolean, p_locked boolean)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_author text;
  v_likes integer;
begin
  if not (p_hidden or p_locked) then
    raise exception 'guideline % is still listed on Arc', p_guideline_id using errcode = 'PM002';
  end if;
  select author_address into v_author from guidelines where id = p_guideline_id for update;
  if not found then
    return false;
  end if;

  if not p_locked then
    select count(*) into v_likes from stars where guideline_id = p_guideline_id;
    if v_likes > 0 then
      insert into pikagold_kept as k (wallet_address, amount) values (v_author, v_likes)
      on conflict (wallet_address) do update set amount = k.amount + excluded.amount;
    end if;
  end if;

  delete from stars where guideline_id = p_guideline_id;
  delete from collections where guideline_id = p_guideline_id;
  delete from reports where guideline_id = p_guideline_id;
  delete from moderation_log where guideline_id = p_guideline_id;
  delete from reviews where guideline_id = p_guideline_id;
  update guidelines set parent_id = null where parent_id = p_guideline_id;
  delete from guideline_versions where guideline_id = p_guideline_id;
  delete from guidelines where id = p_guideline_id;
  insert into purged_guidelines (id) values (p_guideline_id) on conflict (id) do nothing;
  return true;
end;
$$;

-- ── Privileges: the same closed model as every other object (server only) ─────────────────

revoke all on public.purged_guidelines, public.pikagold_kept from anon, authenticated;
grant all on public.purged_guidelines, public.pikagold_kept to service_role;
revoke all on function public.refuse_purged_guideline() from public, anon, authenticated;
revoke all on function public.wallet_profile(text) from public, anon, authenticated;
revoke all on function public.purge_files(bigint) from public, anon, authenticated;
revoke all on function public.purge_guideline(bigint, boolean, boolean) from public, anon, authenticated;
grant execute on function public.wallet_profile(text) to service_role;
grant execute on function public.purge_files(bigint) to service_role;
grant execute on function public.purge_guideline(bigint, boolean, boolean) to service_role;
