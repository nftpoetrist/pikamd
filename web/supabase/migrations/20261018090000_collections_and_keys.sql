-- Collections and MCP keys tied to wallets (K11, K12; 2026-10-18). Applied with `npm run db:migrate`.
--
-- The tables exist since init (collections, mcp_keys with one active key per wallet). These are
-- the only ways the server writes or reads them. The wallet always comes from the signed session
-- (or, for MCP, from the key itself), never from a request body.
--
-- 1. Collections: add (listed guidelines only, at most 500 per wallet), remove, list newest first
-- 2. MCP keys: replace (a new key revokes the old one), revoke, show the active one, and the one
--    call the MCP server makes per request: key hash → that wallet's collection

-- ── 1. Collections ────────────────────────────────────────────────────────────────────────

-- added = it wasn't in the collection yet. P0002 = not a listed guideline, PM001 = collection full.
create function public.add_to_collection(p_wallet text, p_slug text)
returns table (added boolean, total integer)
language plpgsql
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
  v_id bigint;
  v_rows integer;
begin
  select id into v_id from listed_guidelines where slug = p_slug;
  if v_id is null then
    raise exception 'unknown guideline' using errcode = 'P0002';
  end if;
  -- One change per wallet at a time, so the limit holds when adds arrive together
  perform pg_advisory_xact_lock(hashtext('pikamd:collection:' || v_wallet));
  if not exists (select 1 from collections where wallet_address = v_wallet and guideline_id = v_id)
     and (select count(*) from collections where wallet_address = v_wallet) >= 500 then
    raise exception 'collection full' using errcode = 'PM001';
  end if;
  insert into collections (wallet_address, guideline_id) values (v_wallet, v_id)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return query select v_rows > 0,
    (select count(*)::integer from collections c join listed_guidelines g on g.id = c.guideline_id where c.wallet_address = v_wallet);
end;
$$;

-- removed = it was there. Works for guidelines hidden since they were saved, too.
create function public.remove_from_collection(p_wallet text, p_slug text)
returns table (removed boolean, total integer)
language plpgsql
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
  v_rows integer;
begin
  delete from collections c using guidelines g
  where c.guideline_id = g.id and c.wallet_address = v_wallet and g.slug = p_slug;
  get diagnostics v_rows = row_count;
  return query select v_rows > 0,
    (select count(*)::integer from collections c join listed_guidelines g on g.id = c.guideline_id where c.wallet_address = v_wallet);
end;
$$;

-- The wallet's saved guidelines that are listed now, newest first. Hidden or locked ones drop out
-- of the list (and out of MCP) but stay saved: shown again, they come back.
create function public.collection_slugs(p_wallet text)
returns setof text
language sql stable
set search_path = public
as $$
  select g.slug from collections c join listed_guidelines g on g.id = c.guideline_id
  where c.wallet_address = lower(p_wallet)
  order by c.added_at desc, g.id desc;
$$;

-- ── 2. MCP keys ───────────────────────────────────────────────────────────────────────────
-- Only the SHA-256 of a key is ever stored (the browser makes the key and sends the hash).

create function public.replace_mcp_key(p_wallet text, p_hash text, p_masked text)
returns table (masked text, created_at timestamptz)
language plpgsql
set search_path = public
as $$
declare
  v_wallet text := lower(p_wallet);
begin
  perform pg_advisory_xact_lock(hashtext('pikamd:mcp-key:' || v_wallet));
  update mcp_keys set revoked_at = now() where wallet_address = v_wallet and revoked_at is null;
  return query
    insert into mcp_keys as k (key_hash, wallet_address, masked) values (lower(p_hash), v_wallet, p_masked)
    returning k.masked, k.created_at;
end;
$$;

-- revoked = there was an active key.
create function public.revoke_mcp_key(p_wallet text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_rows integer;
begin
  update mcp_keys set revoked_at = now() where wallet_address = lower(p_wallet) and revoked_at is null;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create function public.mcp_key_info(p_wallet text)
returns table (masked text, created_at timestamptz, last_used_at timestamptz)
language sql stable
set search_path = public
as $$
  select k.masked, k.created_at, k.last_used_at from mcp_keys k
  where k.wallet_address = lower(p_wallet) and k.revoked_at is null;
$$;

-- For the MCP server: the collection behind an active key, or no row for an unknown or revoked
-- key. Marks the key as used (at most once a minute, so busy agents don't write on every call).
create function public.mcp_key_collection(p_hash text)
returns table (wallet text, slugs text[])
language plpgsql
set search_path = public
as $$
declare
  v_key mcp_keys%rowtype;
begin
  select * into v_key from mcp_keys where key_hash = lower(p_hash) and revoked_at is null;
  if not found then
    return;
  end if;
  if v_key.last_used_at is null or v_key.last_used_at < now() - interval '1 minute' then
    update mcp_keys set last_used_at = now() where id = v_key.id;
  end if;
  return query select v_key.wallet_address,
    coalesce(array(select collection_slugs(v_key.wallet_address)), '{}'::text[]);
end;
$$;

-- ── Privileges: same closed model as every other object ───────────────────────────────────

revoke all on function public.add_to_collection(text, text) from public, anon, authenticated;
revoke all on function public.remove_from_collection(text, text) from public, anon, authenticated;
revoke all on function public.collection_slugs(text) from public, anon, authenticated;
revoke all on function public.replace_mcp_key(text, text, text) from public, anon, authenticated;
revoke all on function public.revoke_mcp_key(text) from public, anon, authenticated;
revoke all on function public.mcp_key_info(text) from public, anon, authenticated;
revoke all on function public.mcp_key_collection(text) from public, anon, authenticated;
grant execute on function public.add_to_collection(text, text) to service_role;
grant execute on function public.remove_from_collection(text, text) to service_role;
grant execute on function public.collection_slugs(text) to service_role;
grant execute on function public.replace_mcp_key(text, text, text) to service_role;
grant execute on function public.revoke_mcp_key(text) to service_role;
grant execute on function public.mcp_key_info(text) to service_role;
grant execute on function public.mcp_key_collection(text) to service_role;
