-- Rate limits for the write endpoints (security review, 2026-10-15). Applied with npm run db:migrate.
--
-- Fixed windows, one row per key (a hashed client IP or a wallet with the action), counted
-- atomically. Sign-in, prepare, confirm and likes check here before doing anything costly; reads
-- (search, MCP) are limited at the edge by a Vercel WAF rule instead (no database call per read).

create table public.rate_limits (
  key          text primary key check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits         integer not null check (hits >= 1)
);
create index rate_limits_window_idx on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;

-- Counts one hit for p_key and returns true while the window holds at most p_max hits.
create function public.rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    hits         = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else least(r.hits + 1, 1000000) end
  returning hits into v_hits;
  -- Old windows go now and then; the table holds one row per recent key
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;

revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;
revoke all on function public.rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit(text, integer, integer) to service_role;
