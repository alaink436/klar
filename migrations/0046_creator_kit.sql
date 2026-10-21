-- klar_formats + klar_format_variants: the creator kit (spec Projects/Klar/specs/
-- creator-plattform, ticket 03; Alain 2026-10-21: at most 5 formats, rotated in
-- Klar Control; every creator gets his own version so TikTok sees no duplicates).
--
-- A format is one of our slideshows (an HTML template in the vault, rendered like
-- every Basalt post). `config` says how a version may differ: other hooks on the
-- cover (`hooks` + `cover`), other order of the middle slides (`shuffle`), another
-- background tone (`tones`), other query values (`query`, e.g. the Brain or the
-- Sleep edition of a tier list). The routine Projects/Klar/creator-kit/refill.mjs
-- keeps a small pool of rendered versions per active format; a version becomes a
-- creator's the first time his dashboard asks for it (klar_assign_variants) and
-- stays his. The JPEGs live in the private bucket `creator-kit`, with a dHash per
-- slide stored at render time for the image check (ticket 04).
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies). Applied via the Management API (2026-10-21).

create table if not exists public.klar_formats (
  id         text primary key,                   -- the post id in the vault, e.g. 'study-01'
  app_slug   text not null references public.klar_creator_apps(slug) on update cascade,
  name       text not null,
  config     jsonb not null,
  caption    text not null,                      -- suggested caption, always mentions Basalt
  active     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.klar_format_variants (
  id          uuid primary key default gen_random_uuid(),
  format_id   text not null references public.klar_formats(id) on delete cascade,
  seed        integer not null,
  params      jsonb not null,                    -- hook, tone, order, query actually used
  images      text[] not null,                   -- paths in bucket creator-kit, in slide order
  dhash       text[] not null,                   -- 64-bit dHash per slide, hex
  creator_id  uuid references public.klar_creator_accounts(id) on delete set null,
  assigned_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (format_id, seed)
);

create index if not exists klar_format_variants_pool_idx
  on public.klar_format_variants (format_id, created_at) where creator_id is null;

alter table public.klar_formats enable row level security;
alter table public.klar_format_variants enable row level security;

-- Hands the creator one pooled version of every active format of his app he has
-- none of yet, and returns all his versions of active formats. SKIP LOCKED so two
-- creators opening their dashboard at once never get the same version.
create or replace function public.klar_assign_variants(p_creator uuid)
returns setof public.klar_format_variants
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  v uuid;
begin
  for f in
    select fo.id from klar_formats fo
    join klar_creator_accounts c on c.id = p_creator and c.app_slug = fo.app_slug
    where fo.active
      and not exists (select 1 from klar_format_variants x where x.format_id = fo.id and x.creator_id = p_creator)
  loop
    select id into v from klar_format_variants
      where format_id = f.id and creator_id is null
      order by created_at limit 1 for update skip locked;
    if v is not null then
      update klar_format_variants set creator_id = p_creator, assigned_at = now() where id = v;
    end if;
  end loop;
  return query
    select x.* from klar_format_variants x join klar_formats fo on fo.id = x.format_id
    where x.creator_id = p_creator and fo.active
    order by fo.created_at;
end;
$$;

revoke all on function public.klar_assign_variants(uuid) from public, anon, authenticated;

insert into storage.buckets (id, name, public)
values ('creator-kit', 'creator-kit', false)
on conflict (id) do nothing;

-- The first five (Alain 2026-10-21: the formats we have now): the strongest post of
-- each family by views, read from TikTok on 2026-10-21. Switched on in Klar Control.
insert into public.klar_formats (id, app_slug, name, config, caption) values
  ('brain-02', 'basalt', '10/10 habits that change your brain', '{
     "dir": "Projects/Basalt/Content/ads/brain-02", "html": "brain", "slides": 9, "width": 1080, "height": 1440,
     "cover": ".h", "hooks": ["10/10 habits that physically change your brain", "habits that actually rewire your brain", "10 habits your brain will thank you for", "these habits physically change your brain"],
     "shuffle": [2, 7], "tones": ["#ffffff", "#fbfaf7", "#f8f9fa"]}',
   '#brainmaxxing #tierlist #selfimprovement #focus #basalt'),
  ('sleep-02', 'basalt', 'Sleepmaxxing tricks', '{
     "dir": "Projects/Basalt/Content/ads/sleep-02", "html": "sleep", "slides": 11, "width": 1206, "height": 1608,
     "cover": "#cover", "hooks": ["<i>SLEEPMAXXING</i> TRICKS<br>THAT FEEL ILLEGAL<br>TO KNOW", "<i>SLEEPMAXXING</i> TRICKS<br>NOBODY TELLS<br>YOU ABOUT", "<i>SLEEPMAXXING</i> TRICKS<br>THAT ACTUALLY<br>WORK"],
     "shuffle": [2, 9], "tones": ["#ffffff", "#fbfaf7", "#f8f9fa"]}',
   '#sleepmaxxing #sleep #selfimprovement #basalt'),
  ('study-01', 'basalt', 'how to actually study', '{
     "dir": "Projects/Basalt/Content/ads/study-01", "html": "study", "slides": 8, "width": 1080, "height": 1440,
     "cover": ".h", "hooks": ["how to actually study", "how to study when you can''t focus", "how to actually remember what you study", "study smarter, not longer"],
     "shuffle": [2, 6], "tones": ["#ffffff", "#fbfaf7", "#f8f9fa"]}',
   '#studytok #studytips #exam #selfimprovement #basalt'),
  ('habtier-03', 'basalt', 'Habits tier list (film edition)', '{
     "dir": "Projects/Basalt/Content/ads/habtier-03", "html": "habtier", "slides": 6, "width": 1080, "height": 1350,
     "query": {"post": ["a", "b"]}, "tones": ["#edf2ec", "#ecf1ea", "#eef2ee", "#ebf0eb", "#eef3ed"]}',
   '#tierlist #habits #selfimprovement #basalt'),
  ('bdisc-01', 'basalt', 'what discipline does to your brain', '{
     "dir": "Projects/Basalt/Content/ads/bdisc-01", "html": "bdisc", "slides": 8, "width": 1080, "height": 1440,
     "cover": ".h", "hooks": ["what discipline actually looks like in your brain", "what discipline does to your brain", "this is your brain on discipline"],
     "shuffle": [2, 6], "tones": ["#ffffff", "#fbfaf7", "#f8f9fa"]}',
   '#discipline #habits #brain #selfimprovement #basalt')
on conflict (id) do nothing;
