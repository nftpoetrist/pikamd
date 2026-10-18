-- Reports and moderation (ARCHITECTURE §9.2, 2026-10-18). Applied with `npm run db:migrate`.
--
-- Anyone signed in can report a listed guideline once (a reason code and an optional note).
-- Moderators (wallets holding MODERATOR_ROLE in GuidelineRegistry, checked on Arc by the server)
-- lock guidelines on Arc themselves; the index follows the chain. What only lives here: dismissing
-- reports, clearing a scan flag after review, and removing a locked file from our IPFS pins.
-- Every moderator action is written to moderation_log.
--
-- 1. reports: reason codes, optional note, who resolved them and when
-- 2. moderation_log
-- 3. add_report, resolve_reports, approve_flagged, unpinnable_files, mark_unpinned

-- ── 1. Reports ────────────────────────────────────────────────────────────────────────────

alter table public.reports
  add constraint reports_reason_code check (reason in ('harmful', 'secrets', 'personal', 'copyright', 'spam', 'illegal', 'other')),
  add column note        text check (char_length(note) between 1 and 500),
  add column resolved_at timestamptz,
  add column resolved_by text check (resolved_by ~ '^0x[0-9a-f]{40}$');
create index reports_open_idx on public.reports (guideline_id) where status = 'open';

-- ── 2. Moderation log ─────────────────────────────────────────────────────────────────────

create table public.moderation_log (
  id           bigint generated always as identity primary key,
  guideline_id bigint not null references public.guidelines (id),
  moderator    text   not null check (moderator ~ '^0x[0-9a-f]{40}$'),
  action       text   not null check (action in ('lock', 'unlock', 'dismiss', 'approve', 'unpin')),
  tx_hash      text   check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  detail       text   check (char_length(detail) <= 500),
  created_at   timestamptz not null default now()
);
create index moderation_log_guideline_idx on public.moderation_log (guideline_id, created_at desc);
alter table public.moderation_log enable row level security;

-- ── 3. Functions ──────────────────────────────────────────────────────────────────────────

-- created = this wallet's first report on it (one per wallet per guideline). P0002 = not listed.
create function public.add_report(p_wallet text, p_slug text, p_reason text, p_note text)
returns boolean
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
  insert into reports (guideline_id, reporter_address, reason, note)
  values (v_id, lower(p_wallet), p_reason, nullif(btrim(p_note), ''))
  on conflict (guideline_id, reporter_address) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Closes a guideline's open reports as 'dismissed' or 'actioned' and logs it. Returns how many.
create function public.resolve_reports(p_guideline_id bigint, p_status text, p_moderator text, p_tx_hash text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_status not in ('dismissed', 'actioned') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  update reports set status = p_status, resolved_at = now(), resolved_by = lower(p_moderator)
  where guideline_id = p_guideline_id and status = 'open';
  get diagnostics v_rows = row_count;
  if p_status = 'dismissed' and v_rows > 0 then
    insert into moderation_log (guideline_id, moderator, action, detail)
    values (p_guideline_id, lower(p_moderator), 'dismiss', v_rows || ' report(s)');
  end if;
  return v_rows;
end;
$$;

-- A moderator read the flagged lines and found them fine: the latest version is served to agents.
create function public.approve_flagged(p_guideline_id bigint, p_moderator text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_rows integer;
begin
  update guideline_versions v set scan_status = 'clean'
  from guidelines g
  where g.id = p_guideline_id and v.guideline_id = g.id and v.version = g.latest_version and v.scan_status = 'suspicious';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    insert into moderation_log (guideline_id, moderator, action) values (p_guideline_id, lower(p_moderator), 'approve');
  end if;
  return v_rows > 0;
end;
$$;

-- The Pinata files of a locked guideline that nothing else still needs. Pinata gives the same file
-- id to the same content (ARC.md §11, #18), so a file shared with any guideline that isn't locked,
-- or with an upload still waiting, stays pinned.
create function public.unpinnable_files(p_guideline_id bigint)
returns table (version integer, pinata_id text)
language sql stable
set search_path = public
as $$
  select v.version, v.pinata_id from guideline_versions v
  join guidelines g on g.id = v.guideline_id
  where v.guideline_id = p_guideline_id and g.moderator_locked and v.pinata_id is not null
    and not exists (
      select 1 from guideline_versions o join guidelines og on og.id = o.guideline_id
      where o.pinata_id = v.pinata_id and o.guideline_id <> p_guideline_id and not og.moderator_locked)
    and not exists (select 1 from pending_uploads p where p.pinata_id = v.pinata_id);
$$;

create function public.mark_unpinned(p_guideline_id bigint, p_version integer, p_moderator text)
returns void
language sql
set search_path = public
as $$
  update guideline_versions set pinata_id = null where guideline_id = p_guideline_id and version = p_version;
  insert into moderation_log (guideline_id, moderator, action, detail)
  values (p_guideline_id, lower(p_moderator), 'unpin', 'version ' || p_version);
$$;

-- ── Privileges: same closed model as every other object ───────────────────────────────────

revoke all on public.moderation_log from anon, authenticated;
grant all on public.moderation_log to service_role;
revoke all on function public.add_report(text, text, text, text) from public, anon, authenticated;
revoke all on function public.resolve_reports(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.approve_flagged(bigint, text) from public, anon, authenticated;
revoke all on function public.unpinnable_files(bigint) from public, anon, authenticated;
revoke all on function public.mark_unpinned(bigint, integer, text) from public, anon, authenticated;
grant execute on function public.add_report(text, text, text, text) to service_role;
grant execute on function public.resolve_reports(bigint, text, text, text) to service_role;
grant execute on function public.approve_flagged(bigint, text) to service_role;
grant execute on function public.unpinnable_files(bigint) to service_role;
grant execute on function public.mark_unpinned(bigint, integer, text) to service_role;
