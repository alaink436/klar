-- klar_new_variant: a creator asks for a fresh version of one format with "Make me a new one" in his kit (Alain
-- 2026-10-21: creators must be able to make slideshows on their side, not post five and stop). The version comes
-- from the pool the routine renders ahead (creator-kit/refill.mjs), so asking costs nothing but storage. One new
-- version per format every 20 hours, so a single creator cannot empty the pool. Every version he ever got stays
-- his, the image check (ticket 04) recognises all of them.
-- Returns 'ok', 'wait' (too soon), 'empty' (pool dry) or 'no_format'.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd), applied via the Management API (2026-10-21).

create or replace function public.klar_new_variant(p_creator uuid, p_format text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
  v uuid;
begin
  if not exists (
    select 1 from klar_formats fo join klar_creator_accounts c on c.id = p_creator and c.app_slug = fo.app_slug
    where fo.id = p_format and fo.active
  ) then
    return 'no_format';
  end if;
  select max(assigned_at) into last_at from klar_format_variants where creator_id = p_creator and format_id = p_format;
  if last_at is not null and last_at > now() - interval '20 hours' then
    return 'wait';
  end if;
  select id into v from klar_format_variants
    where format_id = p_format and creator_id is null
    order by created_at limit 1 for update skip locked;
  if v is null then
    return 'empty';
  end if;
  update klar_format_variants set creator_id = p_creator, assigned_at = now() where id = v;
  return 'ok';
end;
$$;

revoke all on function public.klar_new_variant(uuid, text) from public, anon, authenticated;
