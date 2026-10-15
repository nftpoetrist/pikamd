-- "Shared by me" on My Collection (2026-10-15). Applied with `npm run db:migrate`.
--
-- author_guidelines(wallet): every guideline the wallet registered, hidden and locked ones too,
-- with its latest version's card fields (no file content) and the two flags, newest first.
-- Only the server calls it, after checking the wallet's session: hidden guidelines are visible to
-- their author only (listed_guidelines stays the public list).

create function public.author_guidelines(p_wallet text)
returns table (
  id bigint, slug text, author_address text, title text, description text, kind text, tags text[],
  license smallint, latest_version integer, uses_count integer, stars_count integer,
  scan_status text, cid text, content_hash text, tx_hash text,
  author_hidden boolean, moderator_locked boolean
)
language sql
stable
set search_path = public
as $$
  select g.id, g.slug, g.author_address, g.title, g.description, g.kind, g.tags,
         g.license, g.latest_version, g.uses_count,
         (select count(*) from stars s where s.guideline_id = g.id and s.removed_at is null)::integer,
         v.scan_status, v.cid, v.content_hash, g.tx_hash,
         g.author_hidden, g.moderator_locked
  from guidelines g
  join guideline_versions v on v.guideline_id = g.id and v.version = g.latest_version
  where g.author_address = lower(p_wallet)
  order by g.block_number desc, g.id desc;
$$;

revoke all on function public.author_guidelines(text) from public, anon, authenticated;
grant execute on function public.author_guidelines(text) to service_role;
