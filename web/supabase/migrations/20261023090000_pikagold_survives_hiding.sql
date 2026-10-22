-- PikaGold an author earned stays theirs when they hide the guideline (2026-10-23).
--
-- PikaGold counted first likes on the author's *listed* guidelines (K22), so hiding one took its
-- PikaGold away, and showing it again gave it back. Once PikaGold can be spent, that would let a
-- balance go below what was already spent. Earned PikaGold now counts every first like on the
-- author's guidelines, hidden ones included. A moderator lock still removes it: a lock is the
-- response to abuse, and PikaGold earned through an abusive guideline shouldn't stand.
-- New likes still need a listed guideline (add_like), so a hidden guideline earns nothing new.

create or replace function public.wallet_profile(p_wallet text)
returns table (pikagold integer, guidelines integer, tips_received text, tips_count integer)
language sql stable
set search_path = public
as $$
  select
    (select count(*) from stars s join guidelines g on g.id = s.guideline_id
     where g.author_address = lower(p_wallet) and not g.moderator_locked)::integer,
    (select count(*) from listed_guidelines where author_address = lower(p_wallet))::integer,
    (select coalesce(sum(amount), 0) from tips where author_address = lower(p_wallet))::text,
    (select count(*) from tips where author_address = lower(p_wallet))::integer;
$$;

revoke all on function public.wallet_profile(text) from public, anon, authenticated;
grant execute on function public.wallet_profile(text) to service_role;
