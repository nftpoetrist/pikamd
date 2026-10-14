-- Registry indexer (ARCHITECTURE §7.4). Run once in the Supabase SQL editor of each project.
--
-- 1. guideline_versions.pinata_id: kept after confirming, so a moderated guideline can be unpinned.
-- 2. indexer_state.updated_at + claim_indexer / save_indexer: one sync at a time, at most every
--    few minutes, resuming from the last processed block.

alter table public.guideline_versions add column pinata_id text check (char_length(pinata_id) <= 64);

alter table public.indexer_state
  add column updated_at timestamptz not null default now();

-- confirm_guideline now carries the Pinata id over from the pending upload (same body otherwise)
create or replace function public.confirm_guideline(
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
    (guideline_id, version, cid, pinata_id, content_hash, content, scan_status, scan_report, tx_hash, block_number, log_index)
  values
    (p_id, 1, p_cid, v_pending.pinata_id, p_content_hash, v_pending.content, v_pending.scan_status, v_pending.scan_report,
     p_tx_hash, p_block_number, p_log_index);

  delete from pending_uploads where id = v_pending.id;
  return v_pending.slug;
end;
$$;

-- Takes the sync turn: returns the last processed block, or null when another sync ran less than
-- p_min_interval_seconds ago (or is running). p_start is used the first time (deploy block - 1).
create function public.claim_indexer(p_key text, p_start bigint, p_min_interval_seconds integer)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_last bigint;
begin
  insert into indexer_state (key, last_block, updated_at)
  values (p_key, p_start, now() - interval '1 day')
  on conflict (key) do nothing;
  update indexer_state set updated_at = now()
  where key = p_key and updated_at <= now() - make_interval(secs => p_min_interval_seconds)
  returning last_block into v_last;
  return v_last;
end;
$$;

-- Records progress; never moves backwards.
create function public.save_indexer(p_key text, p_last_block bigint)
returns void
language sql
set search_path = public
as $$
  update indexer_state set last_block = greatest(last_block, p_last_block), updated_at = now() where key = p_key;
$$;

revoke all on function public.confirm_guideline(text, bigint, text, text, bigint, smallint, text, bigint, integer) from public, anon, authenticated;
revoke all on function public.claim_indexer(text, bigint, integer) from public, anon, authenticated;
revoke all on function public.save_indexer(text, bigint) from public, anon, authenticated;
grant execute on function public.confirm_guideline(text, bigint, text, text, bigint, smallint, text, bigint, integer) to service_role;
grant execute on function public.claim_indexer(text, bigint, integer) to service_role;
grant execute on function public.save_indexer(text, bigint) to service_role;
