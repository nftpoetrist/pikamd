-- PikaMd database (ARCHITECTURE.md §10). Supabase Postgres is the index and cache; the source of
-- truth is the GuidelineRegistry contract on Arc (authors, CIDs, hashes, versions) and IPFS (bytes).
--
-- Access model: only the web server talks to the database, with the project's secret key
-- (role service_role, which bypasses RLS). Every table has RLS on and no policies, and the public
-- roles (anon, authenticated) get no table or function privileges, so the publishable key can't
-- read or write anything, not even through /rest/v1/rpc.
--
-- Wallet addresses are stored lowercase (0x + 40 hex). Run this once in the Supabase SQL editor.

-- ── Tables ─────────────────────────────────────────────────────────────────────────────────

create table public.guidelines (
  id               bigint primary key,                    -- on-chain id (GuidelineRegistry)
  slug             text not null unique
                   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  author_address   text not null check (author_address ~ '^0x[0-9a-f]{40}$'),
  title            text not null check (char_length(title) between 1 and 60),
  description      text not null check (char_length(description) <= 100),
  kind             text not null check (kind in ('rules', 'skill', 'prompt', 'agent', 'guide')),
  tags             text[] not null default '{}'
                   check (cardinality(tags) <= 5),
  license          smallint not null check (license >= 0),  -- index into the contract's licenses
  parent_id        bigint references public.guidelines (id),
  latest_version   integer not null check (latest_version >= 1),
  delisted         boolean not null default false,
  moderator_locked boolean not null default false,
  uses_count       integer not null default 0,
  tx_hash          text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  block_number     bigint not null,
  created_at       timestamptz not null default now()
);
create index guidelines_author_idx on public.guidelines (author_address);

create table public.guideline_versions (
  guideline_id bigint not null references public.guidelines (id),
  version      integer not null check (version >= 1),
  cid          text not null check (char_length(cid) between 1 and 128),
  content_hash text not null check (content_hash ~ '^0x[0-9a-f]{64}$'),  -- sha256 of the UTF-8 bytes
  content      text not null check (octet_length(content) <= 524288),    -- cached copy (512 KB cap)
  scan_status  text not null default 'clean' check (scan_status in ('clean', 'warning', 'suspicious')),
  scan_report  jsonb not null default '{}',
  tx_hash      text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  block_number bigint not null,
  log_index    integer not null,
  created_at   timestamptz not null default now(),
  primary key (guideline_id, version),
  unique (tx_hash, log_index)
);

-- K22: a like is permanent (no delete path) and one per wallet per guideline
create table public.stars (
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  guideline_id   bigint not null references public.guidelines (id),
  created_at     timestamptz not null default now(),
  primary key (wallet_address, guideline_id)
);
create index stars_guideline_idx on public.stars (guideline_id);

create table public.collections (
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  guideline_id   bigint not null references public.guidelines (id),
  pinned_version integer check (pinned_version >= 1),
  added_at       timestamptz not null default now(),
  primary key (wallet_address, guideline_id)
);

-- MCP API keys: only the SHA-256 of the key is stored; one active key per wallet
create table public.mcp_keys (
  id             bigint generated always as identity primary key,
  key_hash       text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  masked         text not null check (char_length(masked) <= 32),  -- e.g. pmd_3f9a…c21e, for the UI
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz
);
create unique index mcp_keys_one_active on public.mcp_keys (wallet_address) where revoked_at is null;

create table public.reports (
  id               bigint generated always as identity primary key,
  guideline_id     bigint not null references public.guidelines (id),
  reporter_address text not null check (reporter_address ~ '^0x[0-9a-f]{40}$'),
  reason           text not null check (char_length(reason) between 1 and 500),
  status           text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at       timestamptz not null default now(),
  unique (guideline_id, reporter_address)
);

-- Publish flow (§7.1): scanned + pinned, waiting for the wallet's register / publishVersion tx
create table public.pending_uploads (
  id             bigint generated always as identity primary key,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  cid            text not null check (char_length(cid) between 1 and 128),
  content_hash   text not null check (content_hash ~ '^0x[0-9a-f]{64}$'),
  content        text not null check (octet_length(content) <= 524288),
  meta           jsonb not null,
  scan_status    text not null check (scan_status in ('clean', 'warning', 'suspicious')),
  scan_report    jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  unique (wallet_address, content_hash)
);

create table public.auth_nonces (
  nonce      text primary key check (nonce ~ '^[0-9a-f]{32}$'),
  expires_at timestamptz not null
);

create table public.indexer_state (
  key        text primary key,
  last_block bigint not null
);

-- ── Lock it down ───────────────────────────────────────────────────────────────────────────

alter table public.guidelines         enable row level security;
alter table public.guideline_versions enable row level security;
alter table public.stars              enable row level security;
alter table public.collections        enable row level security;
alter table public.mcp_keys           enable row level security;
alter table public.reports            enable row level security;
alter table public.pending_uploads    enable row level security;
alter table public.auth_nonces        enable row level security;
alter table public.indexer_state      enable row level security;

-- ── Functions (called by the server with .rpc(); atomic where it matters) ──────────────────

-- Remembers a sign-in nonce. False when too many are pending (abuse guard).
create function public.save_nonce(p_nonce text, p_expires_at timestamptz, p_max_pending integer)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  delete from auth_nonces where expires_at <= now();
  if (select count(*) from auth_nonces) >= p_max_pending then
    return false;
  end if;
  insert into auth_nonces (nonce, expires_at) values (p_nonce, p_expires_at);
  return true;
end;
$$;

-- Single use: true once for an unexpired nonce; the row is gone either way.
create function public.consume_nonce(p_nonce text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  delete from auth_nonces where nonce = p_nonce returning expires_at into v_expires;
  return v_expires is not null and v_expires > now();
end;
$$;

-- Listed guidelines only: delisted ones and versions whose scan says "suspicious" are not served.
create view public.listed_guidelines
with (security_invoker = true) as
select g.*, v.cid, v.content_hash, v.content,
       (select count(*) from stars s where s.guideline_id = g.id)::integer as stars_count
from guidelines g
join guideline_versions v on v.guideline_id = g.id and v.version = g.latest_version
where not g.delisted and v.scan_status <> 'suspicious';

-- Likes a listed guideline. created = false if this wallet had already liked it.
create function public.add_like(p_wallet text, p_slug text)
returns table (created boolean, like_count integer)
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
  insert into stars (wallet_address, guideline_id) values (lower(p_wallet), v_id)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return query select v_rows > 0, (select count(*)::integer from stars where guideline_id = v_id);
end;
$$;

create function public.like_counts()
returns table (slug text, like_count integer)
language sql stable
set search_path = public
as $$
  select slug, stars_count from listed_guidelines;
$$;

create function public.liked_slugs(p_wallet text)
returns setof text
language sql stable
set search_path = public
as $$
  select g.slug from stars s join listed_guidelines g on g.id = s.guideline_id
  where s.wallet_address = lower(p_wallet);
$$;

-- K22: PikaGold = likes on the wallet's listed guidelines (computed, never stored).
create function public.wallet_profile(p_wallet text)
returns table (pikagold integer, guidelines integer)
language sql stable
set search_path = public
as $$
  select coalesce(sum(stars_count), 0)::integer, count(*)::integer
  from listed_guidelines where author_address = lower(p_wallet);
$$;

-- ── Privileges (last, so they cover every table, view and function above) ──────────────────

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all     on all tables    in schema public to service_role;
grant all     on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Objects created later (future migrations) start closed too
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
