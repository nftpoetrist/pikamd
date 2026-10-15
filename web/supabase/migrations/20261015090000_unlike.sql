-- Likes can be taken back (K22, changed 2026-10-15). Run once in the Supabase SQL editor of each project.
--
-- A wallet's first like on a guideline creates its row in `stars` and earns the author 1 PikaGold.
-- Unliking only marks the row (removed_at); the row stays, so the author keeps that PikaGold.
-- Liking again clears the mark on the same row: no new row, so no second PikaGold.
--
-- 1. stars.removed_at
-- 2. listed_guidelines.stars_count = active likes only
-- 3. add_like revives a removed like; remove_like is new
-- 4. liked_slugs = active likes; wallet_profile counts every first like, removed or not

alter table public.stars add column removed_at timestamptz;

-- ── 2. Listed guidelines: the count shown is active likes ─────────────────────────────────

drop view public.listed_guidelines;

create view public.listed_guidelines
with (security_invoker = true) as
select g.*, v.cid, v.content_hash, v.content, v.scan_status,
       (select count(*) from stars s where s.guideline_id = g.id and s.removed_at is null)::integer as stars_count
from guidelines g
join guideline_versions v on v.guideline_id = g.id and v.version = g.latest_version
where not g.author_hidden and not g.moderator_locked;

-- ── 3. Like / unlike ──────────────────────────────────────────────────────────────────────

-- created = this wallet's first like on the guideline (the author earns 1 PikaGold);
-- restored = it had liked before and taken it back (no new PikaGold).
drop function public.add_like(text, text);
create function public.add_like(p_wallet text, p_slug text)
returns table (created boolean, restored boolean, like_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
  v_id bigint;
  v_created integer;
  v_restored integer := 0;
begin
  select id into v_id from listed_guidelines where slug = p_slug;
  if v_id is null then
    raise exception 'unknown guideline' using errcode = 'P0002';
  end if;
  insert into stars (wallet_address, guideline_id) values (v_wallet, v_id)
  on conflict do nothing;
  get diagnostics v_created = row_count;
  if v_created = 0 then
    update stars set removed_at = null
    where wallet_address = v_wallet and guideline_id = v_id and removed_at is not null;
    get diagnostics v_restored = row_count;
  end if;
  return query select v_created > 0, v_restored > 0,
    (select count(*)::integer from stars where guideline_id = v_id and removed_at is null);
end;
$$;

-- removed = false if this wallet had no active like on it. The row is kept (PikaGold stays).
create function public.remove_like(p_wallet text, p_slug text)
returns table (removed boolean, like_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_rows integer;
begin
  select id into v_id from listed_guidelines where slug = p_slug;
  if v_id is null then
    raise exception 'unknown guideline' using errcode = 'P0002';
  end if;
  update stars set removed_at = now()
  where wallet_address = lower(p_wallet) and guideline_id = v_id and removed_at is null;
  get diagnostics v_rows = row_count;
  return query select v_rows > 0,
    (select count(*)::integer from stars where guideline_id = v_id and removed_at is null);
end;
$$;

-- ── 4. Reads ──────────────────────────────────────────────────────────────────────────────

create or replace function public.liked_slugs(p_wallet text)
returns setof text
language sql stable
set search_path = public
as $$
  select g.slug from stars s join listed_guidelines g on g.id = s.guideline_id
  where s.wallet_address = lower(p_wallet) and s.removed_at is null;
$$;

-- PikaGold = first likes on the wallet's listed guidelines, taken back or not (computed, never stored)
create or replace function public.wallet_profile(p_wallet text)
returns table (pikagold integer, guidelines integer)
language sql stable
set search_path = public
as $$
  select
    (select count(*) from stars s join listed_guidelines g on g.id = s.guideline_id
     where g.author_address = lower(p_wallet))::integer,
    (select count(*) from listed_guidelines where author_address = lower(p_wallet))::integer;
$$;

-- ── Privileges: same closed model as every other object ───────────────────────────────────

revoke all on public.listed_guidelines from anon, authenticated;
grant all on public.listed_guidelines to service_role;
revoke all on function public.add_like(text, text) from public, anon, authenticated;
revoke all on function public.remove_like(text, text) from public, anon, authenticated;
grant execute on function public.add_like(text, text) to service_role;
grant execute on function public.remove_like(text, text) to service_role;
