-- OAuth 2.1 for the MCP server (ARCHITECTURE §8.2; 2026-10-25). Applied with `npm run db:migrate`.
--
-- PikaMd is its own authorization server: a person signs in with their wallet on the consent page
-- and an agent (claude.ai, Claude Code, VS Code…) gets a token that reads that wallet's collection.
-- Only SHA-256 hashes of request ids, codes and tokens are stored; the values themselves exist only
-- in the client and in transit. Every state change happens in one function, under a row lock:
--
-- 1. Clients registered dynamically (RFC 7591). Clients with a metadata document (CIMD) aren't
--    stored: their document is fetched and checked on every authorization request.
-- 2. Authorization requests: the checked parameters, waiting on the consent screen (10 minutes)
-- 3. Codes: single use, 60 seconds, bound to client, redirect URI, PKCE challenge and resource
-- 4. Grants (one per connected app) and their tokens: access tokens for an hour, refresh tokens
--    for 30 days, rotated on every use. A refresh token used twice revokes its grant (theft), after
--    a 30-second grace so two refreshes racing from the same client don't disconnect it.

-- ── Tables ────────────────────────────────────────────────────────────────────────────────

create table public.oauth_clients (
  client_id     text primary key check (client_id ~ '^pmdc_[A-Za-z0-9_-]{43}$'),
  client_name   text not null check (char_length(client_name) between 1 and 100),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create table public.oauth_requests (
  id_hash        text primary key check (id_hash ~ '^[0-9a-f]{64}$'),
  client_id      text not null check (char_length(client_id) between 1 and 512),
  client_kind    text not null check (client_kind in ('cimd', 'dcr')),
  client_name    text not null check (char_length(client_name) between 1 and 100),
  client_host    text check (char_length(client_host) <= 253),
  redirect_uri   text not null check (char_length(redirect_uri) between 1 and 2000),
  state          text check (char_length(state) <= 1000),
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  resource       text not null check (char_length(resource) between 1 and 500),
  scope          text not null check (char_length(scope) between 1 and 200),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  consumed_at    timestamptz
);
create index oauth_requests_expires_idx on public.oauth_requests (expires_at);

create table public.oauth_grants (
  id            uuid primary key default gen_random_uuid(),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  client_id     text not null check (char_length(client_id) between 1 and 512),
  client_kind   text not null check (client_kind in ('cimd', 'dcr')),
  client_name   text not null check (char_length(client_name) between 1 and 100),
  client_host   text check (char_length(client_host) <= 253),
  scope         text not null check (char_length(scope) between 1 and 200),
  resource      text not null check (char_length(resource) between 1 and 500),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  revoke_reason text check (revoke_reason in ('user', 'client', 'refresh_reuse', 'code_reuse', 'replaced'))
);
create index oauth_grants_wallet_idx on public.oauth_grants (wallet_address) where revoked_at is null;

create table public.oauth_codes (
  code_hash      text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  client_id      text not null,
  client_kind    text not null check (client_kind in ('cimd', 'dcr')),
  client_name    text not null,
  client_host    text,
  redirect_uri   text not null,
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  resource       text not null,
  scope          text not null,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  grant_id       uuid references public.oauth_grants (id) on delete set null
);
create index oauth_codes_expires_idx on public.oauth_codes (expires_at);

create table public.oauth_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  kind       text not null check (kind in ('access', 'refresh')),
  grant_id   uuid not null references public.oauth_grants (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,    -- refresh tokens: rotated (spent)
  revoked_at timestamptz     -- access tokens revoked one by one (RFC 7009)
);
create index oauth_tokens_grant_idx on public.oauth_tokens (grant_id);
create index oauth_tokens_expires_idx on public.oauth_tokens (expires_at);

alter table public.oauth_clients  enable row level security;
alter table public.oauth_requests enable row level security;
alter table public.oauth_grants   enable row level security;
alter table public.oauth_codes    enable row level security;
alter table public.oauth_tokens   enable row level security;
grant all on public.oauth_clients, public.oauth_requests, public.oauth_grants, public.oauth_codes, public.oauth_tokens to service_role;

-- ── 1. Dynamically registered clients ─────────────────────────────────────────────────────

create function public.oauth_register_client(p_client_id text, p_name text, p_redirect_uris text[])
returns void
language sql
set search_path = public
as $$
  insert into oauth_clients (client_id, client_name, redirect_uris) values (p_client_id, p_name, p_redirect_uris);
$$;

create function public.oauth_dcr_client(p_client_id text)
returns table (client_name text, redirect_uris text[])
language sql stable
set search_path = public
as $$
  select c.client_name, c.redirect_uris from oauth_clients c where c.client_id = p_client_id;
$$;

-- ── 2. Authorization requests ─────────────────────────────────────────────────────────────

create function public.oauth_create_request(
  p_id_hash text, p_client_id text, p_client_kind text, p_client_name text, p_client_host text,
  p_redirect_uri text, p_state text, p_code_challenge text, p_resource text, p_scope text, p_ttl_seconds integer
)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into oauth_requests (id_hash, client_id, client_kind, client_name, client_host, redirect_uri, state, code_challenge, resource, scope, expires_at)
  values (p_id_hash, p_client_id, p_client_kind, p_client_name, p_client_host, p_redirect_uri, p_state, p_code_challenge, p_resource, p_scope,
          now() + make_interval(secs => p_ttl_seconds));
  -- Housekeeping: requests, codes and tokens a day past their expiry are of no use to anyone
  if random() < 0.05 then
    delete from oauth_requests where expires_at < now() - interval '1 day';
    delete from oauth_codes where expires_at < now() - interval '1 day';
    delete from oauth_tokens where expires_at < now() - interval '1 day';
  end if;
end;
$$;

-- What the consent screen shows. No row: unknown, expired or already answered.
create function public.oauth_request_info(p_id_hash text)
returns table (client_kind text, client_name text, client_host text, redirect_uri text, scope text, expires_at timestamptz)
language sql stable
set search_path = public
as $$
  select r.client_kind, r.client_name, r.client_host, r.redirect_uri, r.scope, r.expires_at from oauth_requests r
  where r.id_hash = p_id_hash and r.consumed_at is null and r.expires_at > now();
$$;

-- Allow: the request is answered (once) and a code is issued for the signed-in wallet.
create function public.oauth_approve(p_id_hash text, p_wallet text, p_code_hash text, p_code_ttl_seconds integer)
returns table (redirect_uri text, state text)
language plpgsql
set search_path = public
as $$
declare
  v_req oauth_requests%rowtype;
begin
  select * into v_req from oauth_requests where id_hash = p_id_hash for update;
  if not found or v_req.consumed_at is not null or v_req.expires_at <= now() then
    return;
  end if;
  update oauth_requests set consumed_at = now() where id_hash = p_id_hash;
  insert into oauth_codes (code_hash, client_id, client_kind, client_name, client_host, redirect_uri, code_challenge, resource, scope, wallet_address, expires_at)
  values (p_code_hash, v_req.client_id, v_req.client_kind, v_req.client_name, v_req.client_host, v_req.redirect_uri, v_req.code_challenge,
          v_req.resource, v_req.scope, lower(p_wallet), now() + make_interval(secs => p_code_ttl_seconds));
  if v_req.client_kind = 'dcr' then
    update oauth_clients set last_used_at = now() where client_id = v_req.client_id;
  end if;
  return query select v_req.redirect_uri, v_req.state;
end;
$$;

-- Cancel: the request is answered (once); the client is told access_denied.
create function public.oauth_deny(p_id_hash text)
returns table (redirect_uri text, state text)
language plpgsql
set search_path = public
as $$
declare
  v_req oauth_requests%rowtype;
begin
  select * into v_req from oauth_requests where id_hash = p_id_hash for update;
  if not found or v_req.consumed_at is not null or v_req.expires_at <= now() then
    return;
  end if;
  update oauth_requests set consumed_at = now() where id_hash = p_id_hash;
  return query select v_req.redirect_uri, v_req.state;
end;
$$;

-- ── 3 and 4. Codes, grants, tokens ────────────────────────────────────────────────────────

-- A new grant with its first token pair. A wallet keeps at most 50 connected apps: the oldest
-- active grant beyond that is revoked ('replaced').
create function public.oauth_new_grant(
  p_wallet text, p_client_id text, p_client_kind text, p_client_name text, p_client_host text, p_scope text, p_resource text,
  p_access_hash text, p_refresh_hash text, p_access_ttl integer, p_refresh_ttl integer
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_grant uuid;
begin
  perform pg_advisory_xact_lock(hashtext('pikamd:oauth-grants:' || p_wallet));
  insert into oauth_grants (wallet_address, client_id, client_kind, client_name, client_host, scope, resource, last_used_at)
  values (p_wallet, p_client_id, p_client_kind, p_client_name, p_client_host, p_scope, p_resource, now())
  returning id into v_grant;
  insert into oauth_tokens (token_hash, kind, grant_id, expires_at) values
    (p_access_hash, 'access', v_grant, now() + make_interval(secs => p_access_ttl)),
    (p_refresh_hash, 'refresh', v_grant, now() + make_interval(secs => p_refresh_ttl));
  update oauth_grants set revoked_at = now(), revoke_reason = 'replaced'
  where id in (
    select g.id from oauth_grants g where g.wallet_address = p_wallet and g.revoked_at is null
    order by g.created_at desc, g.id offset 50
  );
  return v_grant;
end;
$$;

-- status: ok | invalid_grant | invalid_target. p_verifier_challenge is S256(code_verifier),
-- computed by the server; p_redirect_uri and p_resource are null when the request left them out.
-- A code presented again after it was exchanged revokes the grant it opened (OAuth 2.1 §4.1.3).
create function public.oauth_exchange_code(
  p_code_hash text, p_client_id text, p_redirect_uri text, p_verifier_challenge text, p_resource text,
  p_access_hash text, p_refresh_hash text, p_access_ttl integer, p_refresh_ttl integer
)
returns table (status text, scope text)
language plpgsql
set search_path = public
as $$
declare
  v_code oauth_codes%rowtype;
  v_grant uuid;
begin
  select * into v_code from oauth_codes where code_hash = p_code_hash for update;
  if not found then
    return query select 'invalid_grant', null::text; return;
  end if;
  if v_code.used_at is not null then
    update oauth_grants set revoked_at = now(), revoke_reason = 'code_reuse' where id = v_code.grant_id and revoked_at is null;
    return query select 'invalid_grant', null::text; return;
  end if;
  if v_code.expires_at <= now()
     or v_code.client_id <> p_client_id
     or (p_redirect_uri is not null and v_code.redirect_uri <> p_redirect_uri)
     or v_code.code_challenge <> p_verifier_challenge then
    return query select 'invalid_grant', null::text; return;
  end if;
  if p_resource is not null and p_resource <> v_code.resource then
    return query select 'invalid_target', null::text; return;
  end if;
  v_grant := oauth_new_grant(v_code.wallet_address, v_code.client_id, v_code.client_kind, v_code.client_name, v_code.client_host,
                             v_code.scope, v_code.resource, p_access_hash, p_refresh_hash, p_access_ttl, p_refresh_ttl);
  update oauth_codes set used_at = now(), grant_id = v_grant where code_hash = p_code_hash;
  return query select 'ok', v_code.scope;
end;
$$;

-- status: ok | invalid_grant | invalid_target. Rotates the refresh token: the old one is spent and a
-- new pair is issued in the same grant. A spent token presented again more than 30 seconds after
-- it was spent revokes the grant: someone else holds a copy.
create function public.oauth_refresh(
  p_refresh_hash text, p_client_id text, p_resource text,
  p_access_hash text, p_new_refresh_hash text, p_access_ttl integer, p_refresh_ttl integer
)
returns table (status text, scope text)
language plpgsql
set search_path = public
as $$
declare
  v_tok oauth_tokens%rowtype;
  v_grant oauth_grants%rowtype;
begin
  select * into v_tok from oauth_tokens where token_hash = p_refresh_hash and kind = 'refresh' for update;
  if not found then
    return query select 'invalid_grant', null::text; return;
  end if;
  select * into v_grant from oauth_grants where id = v_tok.grant_id for update;
  if v_grant.revoked_at is not null or v_grant.client_id <> p_client_id then
    return query select 'invalid_grant', null::text; return;
  end if;
  if v_tok.used_at is not null then
    if v_tok.used_at < now() - interval '30 seconds' then
      update oauth_grants set revoked_at = now(), revoke_reason = 'refresh_reuse' where id = v_grant.id;
    end if;
    return query select 'invalid_grant', null::text; return;
  end if;
  if v_tok.expires_at <= now() then
    return query select 'invalid_grant', null::text; return;
  end if;
  if p_resource is not null and p_resource <> v_grant.resource then
    return query select 'invalid_target', null::text; return;
  end if;
  update oauth_tokens set used_at = now() where token_hash = p_refresh_hash;
  insert into oauth_tokens (token_hash, kind, grant_id, expires_at) values
    (p_access_hash, 'access', v_grant.id, now() + make_interval(secs => p_access_ttl)),
    (p_new_refresh_hash, 'refresh', v_grant.id, now() + make_interval(secs => p_refresh_ttl));
  update oauth_grants set last_used_at = now() where id = v_grant.id;
  return query select 'ok', v_grant.scope;
end;
$$;

-- For the MCP server, once per request: a valid access token for this resource → its wallet, scope,
-- expiry and the wallet's collection. No row: unknown, expired, revoked, or for another resource.
create function public.oauth_access(p_access_hash text, p_resource text)
returns table (wallet text, client_id text, scope text, expires_at timestamptz, slugs text[])
language plpgsql
set search_path = public
as $$
declare
  v_tok oauth_tokens%rowtype;
  v_grant oauth_grants%rowtype;
begin
  select * into v_tok from oauth_tokens where token_hash = p_access_hash and kind = 'access';
  if not found or v_tok.revoked_at is not null or v_tok.expires_at <= now() then
    return;
  end if;
  select * into v_grant from oauth_grants where id = v_tok.grant_id;
  if v_grant.revoked_at is not null or v_grant.resource <> p_resource then
    return;
  end if;
  if v_grant.last_used_at is null or v_grant.last_used_at < now() - interval '1 minute' then
    update oauth_grants set last_used_at = now() where id = v_grant.id;
  end if;
  return query select v_grant.wallet_address, v_grant.client_id, v_grant.scope, v_tok.expires_at,
    coalesce(array(select collection_slugs(v_grant.wallet_address)), '{}'::text[]);
end;
$$;

-- RFC 7009: a refresh token revokes its whole grant; an access token only itself. A token another
-- client presents is left alone (the endpoint answers 200 either way).
create function public.oauth_revoke_token(p_token_hash text, p_client_id text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_tok oauth_tokens%rowtype;
  v_client text;
begin
  select * into v_tok from oauth_tokens where token_hash = p_token_hash;
  if not found then
    return false;
  end if;
  select client_id into v_client from oauth_grants where id = v_tok.grant_id;
  if v_client <> p_client_id then
    return false;
  end if;
  if v_tok.kind = 'refresh' then
    update oauth_grants set revoked_at = now(), revoke_reason = 'client' where id = v_tok.grant_id and revoked_at is null;
  else
    update oauth_tokens set revoked_at = now() where token_hash = p_token_hash and revoked_at is null;
  end if;
  return true;
end;
$$;

-- The wallet's connected apps: grants not revoked that still hold an unspent, unexpired refresh token.
create function public.oauth_wallet_grants(p_wallet text)
returns table (id uuid, client_kind text, client_name text, client_host text, created_at timestamptz, last_used_at timestamptz)
language sql stable
set search_path = public
as $$
  select g.id, g.client_kind, g.client_name, g.client_host, g.created_at, g.last_used_at from oauth_grants g
  where g.wallet_address = lower(p_wallet) and g.revoked_at is null
    and exists (select 1 from oauth_tokens t where t.grant_id = g.id and t.kind = 'refresh' and t.used_at is null and t.expires_at > now())
  order by g.last_used_at desc nulls last, g.created_at desc;
$$;

-- Disconnect: only the wallet's own grant. revoked = it was active.
create function public.oauth_revoke_grant(p_wallet text, p_grant_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_rows integer;
begin
  update oauth_grants set revoked_at = now(), revoke_reason = 'user'
  where id = p_grant_id and wallet_address = lower(p_wallet) and revoked_at is null;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- ── Privileges: same closed model as every other object ───────────────────────────────────

revoke all on function public.oauth_register_client(text, text, text[]) from public, anon, authenticated;
revoke all on function public.oauth_dcr_client(text) from public, anon, authenticated;
revoke all on function public.oauth_create_request(text, text, text, text, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.oauth_request_info(text) from public, anon, authenticated;
revoke all on function public.oauth_approve(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.oauth_deny(text) from public, anon, authenticated;
revoke all on function public.oauth_new_grant(text, text, text, text, text, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.oauth_exchange_code(text, text, text, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.oauth_refresh(text, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.oauth_access(text, text) from public, anon, authenticated;
revoke all on function public.oauth_revoke_token(text, text) from public, anon, authenticated;
revoke all on function public.oauth_wallet_grants(text) from public, anon, authenticated;
revoke all on function public.oauth_revoke_grant(text, uuid) from public, anon, authenticated;
grant execute on function public.oauth_register_client(text, text, text[]) to service_role;
grant execute on function public.oauth_dcr_client(text) to service_role;
grant execute on function public.oauth_create_request(text, text, text, text, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.oauth_request_info(text) to service_role;
grant execute on function public.oauth_approve(text, text, text, integer) to service_role;
grant execute on function public.oauth_deny(text) to service_role;
grant execute on function public.oauth_new_grant(text, text, text, text, text, text, text, text, text, integer, integer) to service_role;
grant execute on function public.oauth_exchange_code(text, text, text, text, text, text, text, integer, integer) to service_role;
grant execute on function public.oauth_refresh(text, text, text, text, text, integer, integer) to service_role;
grant execute on function public.oauth_access(text, text) to service_role;
grant execute on function public.oauth_revoke_token(text, text) to service_role;
grant execute on function public.oauth_wallet_grants(text) to service_role;
grant execute on function public.oauth_revoke_grant(text, uuid) to service_role;
