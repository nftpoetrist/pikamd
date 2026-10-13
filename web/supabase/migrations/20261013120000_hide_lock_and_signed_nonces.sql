-- Run once in the Supabase SQL editor, after 20261013000000_init.sql.
--
-- 1. The registry keeps the author's hide and a moderator's lock in two flags (GuidelineRegistry
--    setHidden / setModeratorLock). Mirror them: a guideline is listed only when neither is set.
-- 2. Sign-in nonces are signed by the server (web/lib/auth/nonce.ts) and no longer stored when
--    issued, so the public nonce endpoint can't fill this table. Only nonces that a valid wallet
--    signature used are remembered, until they expire, to stop replays.

alter table public.guidelines rename column delisted to author_hidden;

drop view public.listed_guidelines;

create view public.listed_guidelines
with (security_invoker = true) as
select g.*, v.cid, v.content_hash, v.content,
       (select count(*) from stars s where s.guideline_id = g.id)::integer as stars_count
from guidelines g
join guideline_versions v on v.guideline_id = g.id and v.version = g.latest_version
where not g.author_hidden and not g.moderator_locked and v.scan_status <> 'suspicious';

-- Same closed access as every other object (see the init migration)
revoke all on public.listed_guidelines from anon, authenticated;
grant all on public.listed_guidelines to service_role;

-- ── 2. Used sign-in nonces ─────────────────────────────────────────────────────────────────

drop function public.save_nonce(text, timestamptz, integer);
drop function public.consume_nonce(text);
delete from public.auth_nonces;
alter table public.auth_nonces drop constraint auth_nonces_nonce_check;
alter table public.auth_nonces add constraint auth_nonces_nonce_check check (nonce ~ '^[0-9a-f]{48}$');

-- True the first time a nonce is used, false on a replay. Expired rows are cleared on the way.
create function public.use_nonce(p_nonce text, p_expires_at timestamptz)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_rows integer;
begin
  delete from auth_nonces where expires_at <= now();
  insert into auth_nonces (nonce, expires_at) values (p_nonce, p_expires_at)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.use_nonce(text, timestamptz) from public, anon, authenticated;
grant execute on function public.use_nonce(text, timestamptz) to service_role;
