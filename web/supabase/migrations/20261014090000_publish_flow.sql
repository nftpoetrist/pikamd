-- Publish flow (ARCHITECTURE §7.1). Run once in the Supabase SQL editor of each project, after the
-- earlier migrations.
--
-- 1. pending_uploads reserves the guideline's name (slug) while the author's wallet registers it,
--    and remembers the Pinata file id (to unpin abandoned uploads).
-- 2. prepare_upload / confirm_guideline: the two server steps, each atomic.
-- 3. listed_guidelines keeps guidelines whose scan says "suspicious" and exposes scan_status:
--    the site shows them, the MCP server doesn't serve them until a moderator checks them (§8, §9.1).

-- ── 1. Pending uploads ─────────────────────────────────────────────────────────────────────

delete from public.pending_uploads;
alter table public.pending_uploads
  add column slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  add column pinata_id text check (char_length(pinata_id) <= 64);

-- ── 2. Server steps ────────────────────────────────────────────────────────────────────────

-- Reserves the slug for this wallet and stores the scanned, pinned file. 'ok' or 'slug_taken'.
-- A wallet preparing again (same slug or same file) replaces its own earlier reservation.
create function public.prepare_upload(
  p_wallet text, p_slug text, p_cid text, p_pinata_id text, p_content_hash text, p_content text,
  p_meta jsonb, p_scan_status text, p_scan_report jsonb, p_ttl_seconds integer
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
begin
  delete from pending_uploads where expires_at <= now();
  if exists (select 1 from guidelines where slug = p_slug) then
    return 'slug_taken';
  end if;
  if exists (select 1 from pending_uploads where slug = p_slug and wallet_address <> v_wallet) then
    return 'slug_taken';
  end if;
  delete from pending_uploads
  where wallet_address = v_wallet and (slug = p_slug or content_hash = p_content_hash);
  insert into pending_uploads
    (wallet_address, slug, cid, pinata_id, content_hash, content, meta, scan_status, scan_report, expires_at)
  values
    (v_wallet, p_slug, p_cid, p_pinata_id, p_content_hash, p_content, p_meta, p_scan_status, p_scan_report,
     now() + make_interval(secs => p_ttl_seconds));
  return 'ok';
end;
$$;

-- Indexes a registration the server has verified on-chain (receipt + GuidelineRegistered event):
-- the wallet's pending upload with this exact CID and hash becomes guideline p_id, version 1.
-- Returns the slug. Calling it again for the same registration returns the same slug.
create function public.confirm_guideline(
  p_wallet text, p_id bigint, p_cid text, p_content_hash text, p_parent_id bigint, p_license smallint,
  p_tx_hash text, p_block_number bigint, p_log_index integer
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
  v_pending pending_uploads%rowtype;
  v_slug text;
begin
  select slug into v_slug from guidelines where id = p_id and author_address = v_wallet;
  if v_slug is not null then
    return v_slug;
  end if;

  select * into v_pending from pending_uploads
  where wallet_address = v_wallet and content_hash = p_content_hash and cid = p_cid
  for update;
  if not found then
    raise exception 'no matching upload' using errcode = 'P0002';
  end if;

  insert into guidelines
    (id, slug, author_address, title, description, kind, tags, license, parent_id, latest_version, tx_hash, block_number)
  values
    (p_id, v_pending.slug, v_wallet, v_pending.meta->>'title', v_pending.meta->>'description', v_pending.meta->>'kind',
     array(select jsonb_array_elements_text(coalesce(v_pending.meta->'tags', '[]'::jsonb))),
     p_license, nullif(p_parent_id, 0), 1, p_tx_hash, p_block_number);

  insert into guideline_versions
    (guideline_id, version, cid, content_hash, content, scan_status, scan_report, tx_hash, block_number, log_index)
  values
    (p_id, 1, p_cid, p_content_hash, v_pending.content, v_pending.scan_status, v_pending.scan_report,
     p_tx_hash, p_block_number, p_log_index);

  delete from pending_uploads where id = v_pending.id;
  return v_pending.slug;
end;
$$;

-- ── 3. Listed guidelines keep flagged ones, with their scan status ────────────────────────

drop view public.listed_guidelines;

create view public.listed_guidelines
with (security_invoker = true) as
select g.*, v.cid, v.content_hash, v.content, v.scan_status,
       (select count(*) from stars s where s.guideline_id = g.id)::integer as stars_count
from guidelines g
join guideline_versions v on v.guideline_id = g.id and v.version = g.latest_version
where not g.author_hidden and not g.moderator_locked;

-- ── Privileges: same closed model as every other object ───────────────────────────────────

revoke all on public.listed_guidelines from anon, authenticated;
grant all on public.listed_guidelines to service_role;
revoke all on function public.prepare_upload(text, text, text, text, text, text, jsonb, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.confirm_guideline(text, bigint, text, text, bigint, smallint, text, bigint, integer) from public, anon, authenticated;
grant execute on function public.prepare_upload(text, text, text, text, text, text, jsonb, text, jsonb, integer) to service_role;
grant execute on function public.confirm_guideline(text, bigint, text, text, bigint, smallint, text, bigint, integer) to service_role;
