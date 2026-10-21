-- klar_view_accounts + klar_posts + klar_post_views: view counts of the posts
-- that advertise our apps, read every 2 hours, as the input for estimating
-- which creator brought which installs (Alain, 2026-10-21: creators without a
-- link are paid from the estimate; "dann bauen wir das so").
--
-- TikTok does not say *when* a post got its views, only the total right now.
-- So an Apify schedule scrapes the tracked profiles every 2 h and
-- /api/post-views/ingest stores one row per post and run in klar_post_views;
-- the differences between rows are the view curve.
--
-- klar_view_accounts lists whose posts we read. `source` keeps our own
-- channels apart from creators: own posts must be in the estimate too,
-- otherwise their spikes are credited to someone else.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies). Applied via MCP migration `post_views` (2026-10-21).

create table if not exists public.klar_view_accounts (
  id         uuid primary key default gen_random_uuid(),
  platform   text not null default 'tiktok' check (platform in ('tiktok')),
  handle     text not null,                       -- without @
  app_slug   text not null references public.klar_creator_apps(slug) on update cascade,
  source     text not null check (source in ('own', 'creator')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform, handle)
);

create table if not exists public.klar_posts (
  post_id      text primary key,                  -- the platform's id, e.g. TikTok video id
  platform     text not null,
  handle       text not null,
  posted_at    timestamptz not null,
  url          text,
  is_slideshow boolean,
  first_seen_at timestamptz not null default now()
);

create index if not exists klar_posts_handle_posted_idx
  on public.klar_posts (platform, handle, posted_at desc);

create table if not exists public.klar_post_views (
  post_id    text not null references public.klar_posts(post_id) on delete cascade,
  fetched_at timestamptz not null,                 -- when the scrape run finished
  views      bigint not null,
  likes      bigint,
  comments   bigint,
  shares     bigint,
  saves      bigint,
  primary key (post_id, fetched_at)
);

alter table public.klar_view_accounts enable row level security;
alter table public.klar_posts enable row level security;
alter table public.klar_post_views enable row level security;

-- Our own Basalt channels, the first two accounts read.
insert into public.klar_view_accounts (platform, handle, app_slug, source) values
  ('tiktok', 'motivationwithbasalt', 'basalt', 'own'),
  ('tiktok', 'basaltapp_de', 'basalt', 'own')
on conflict (platform, handle) do nothing;
