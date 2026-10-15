-- Publish hardening (security review, 2026-10-15). Applied with npm run db:migrate.
--
-- 1. confirm_guideline
--    - A parentId the index doesn't know (a guideline registered on Arc but never through this site)
--      is stored as "no parent"; the chain keeps the real one. Before, the foreign key failed the
--      insert, and the indexer retried the same block range forever: no hide, lock or registration
--      after it would ever reach the site.
--    - A confirm that waited on the indexer's confirm of the same registration returns the slug
--      instead of "no matching upload".
-- 2. prepare_check / prepare_upload: at most 5 unfinished uploads per wallet and 100 MB of
--    unfinished uploads in all, so free sign-ins can't fill the database or the Pinata plan.
--    prepare_check answers before the file is pinned; prepare_upload re-checks atomically.
-- 3. scan_report stays small (the app stores at most 200 findings).

-- ── 1. Confirm ────────────────────────────────────────────────────────────────────────────

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
  v_parent bigint;
begin
  select slug into v_slug from guidelines where id = p_id and author_address = v_wallet;
  if v_slug is not null then
    return v_slug;
  end if;

  select * into v_pending from pending_uploads
  where wallet_address = v_wallet and content_hash = p_content_hash and cid = p_cid
  for update;
  if not found then
    -- Another confirm of this registration may have just finished (it deleted the upload)
    select slug into v_slug from guidelines where id = p_id and author_address = v_wallet;
    if v_slug is not null then
      return v_slug;
    end if;
    raise exception 'no matching upload' using errcode = 'P0002';
  end if;

  select id into v_parent from guidelines where id = nullif(p_parent_id, 0);

  insert into guidelines
    (id, slug, author_address, title, description, kind, tags, license, parent_id, latest_version, tx_hash, block_number)
  values
    (p_id, v_pending.slug, v_wallet, v_pending.meta->>'title', v_pending.meta->>'description', v_pending.meta->>'kind',
     array(select jsonb_array_elements_text(coalesce(v_pending.meta->'tags', '[]'::jsonb))),
     p_license, v_parent, 1, p_tx_hash, p_block_number);

  insert into guideline_versions
    (guideline_id, version, cid, pinata_id, content_hash, content, scan_status, scan_report, tx_hash, block_number, log_index)
  values
    (p_id, 1, p_cid, v_pending.pinata_id, p_content_hash, v_pending.content, v_pending.scan_status, v_pending.scan_report,
     p_tx_hash, p_block_number, p_log_index);

  delete from pending_uploads where id = v_pending.id;
  return v_pending.slug;
end;
$$;

-- ── 2. Prepare: limits ────────────────────────────────────────────────────────────────────

-- 'ok', 'slug_taken', 'too_many' (this wallet has 5 unfinished uploads) or 'busy' (100 MB of
-- unfinished uploads in all). A wallet re-preparing the same name or the same file replaces its
-- own upload, so that never counts against it.
create function public.prepare_check(p_wallet text, p_slug text, p_content_hash text, p_bytes integer)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
begin
  if exists (select 1 from guidelines where slug = p_slug) then
    return 'slug_taken';
  end if;
  if exists (select 1 from pending_uploads where slug = p_slug and wallet_address <> v_wallet and expires_at > now()) then
    return 'slug_taken';
  end if;
  if (select count(*) from pending_uploads
      where wallet_address = v_wallet and expires_at > now()
        and slug <> p_slug and content_hash <> p_content_hash) >= 5 then
    return 'too_many';
  end if;
  if (select coalesce(sum(octet_length(content)), 0) from pending_uploads where expires_at > now()) + p_bytes > 100 * 1024 * 1024 then
    return 'busy';
  end if;
  return 'ok';
end;
$$;

create or replace function public.prepare_upload(
  p_wallet text, p_slug text, p_cid text, p_pinata_id text, p_content_hash text, p_content text,
  p_meta jsonb, p_scan_status text, p_scan_report jsonb, p_ttl_seconds integer
)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
  v_status text;
begin
  -- One prepare at a time, so two can't both pass the limits below
  lock table pending_uploads in share row exclusive mode;
  delete from pending_uploads where expires_at <= now();
  v_status := prepare_check(v_wallet, p_slug, p_content_hash, octet_length(p_content));
  if v_status <> 'ok' then
    return v_status;
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

-- ── 3. Small scan reports ─────────────────────────────────────────────────────────────────

alter table public.pending_uploads add constraint pending_uploads_scan_report_size
  check (octet_length(scan_report::text) <= 65536);
alter table public.guideline_versions add constraint guideline_versions_scan_report_size
  check (octet_length(scan_report::text) <= 65536);

-- ── Privileges: same closed model as every other object ───────────────────────────────────

revoke all on function public.prepare_check(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.prepare_check(text, text, text, integer) to service_role;
