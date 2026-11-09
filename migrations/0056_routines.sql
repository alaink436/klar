-- klar_routines + klar_routine_posts: the daily TikTok post routines in Klar Control
-- (Alain 2026-11-09: "dass die Routinen in Klar Control eingetragen sind, und dass ich dann die Frequenz dort
-- auch gleich mit einstellen kann, und dass dort Apify auch bereits schaut. Also dass man immer sieht welcher Post
-- gut performt hat").
--
-- klar_routines: one row per app. `slots` are the posting times (Europe/Zurich, "HH:MM"); their number is the
-- frequency. The cloud routines read their row through GET /api/routines at the start of each run (the recipe stays
-- in the vault, Projects/Klar-Content-Pipeline/TAGESROUTINE.md). Edited on /admin/routinen.
--
-- klar_routine_posts: every post a routine scheduled as a TikTok draft, reported through POST /api/routines/posts.
-- Alain posts the drafts by hand, so Blotato never learns the TikTok id. lib/routineMatch.ts ties a routine post to
-- the TikTok post Apify read (klar_posts) by hashtags and time; `post_id` is that link.
--
-- klar_posts.caption: the post's text as Apify reads it. For our photo posts it is only the hashtag line (the hook
-- is the title, which the scraper does not return), measured on 2026-11-09.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role only (no policies).

alter table public.klar_posts add column if not exists caption text;

create table if not exists public.klar_routines (
  app_slug   text primary key references public.klar_creator_apps(slug) on update cascade,
  accounts   jsonb not null default '[]'::jsonb,       -- [{"handle": "...", "blotato_id": "..."}]
  slots      text[] not null default '{}',             -- ["13:00", "18:00", "22:00"]
  credits    numeric not null default 0,               -- Higgsfield credits per day
  run_at     text,                                     -- when the cloud routine runs, for display only
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint klar_routines_slots_format check (array_to_string(slots, ',') ~ '^([0-2][0-9]:[0-5][0-9](,|$))*$')
);

create table if not exists public.klar_routine_posts (
  id            uuid primary key default gen_random_uuid(),
  app_slug      text not null references public.klar_routines(app_slug) on update cascade,
  handle        text not null,                         -- without @
  name          text not null,                         -- the routine's key, e.g. "chat-01"
  format        text,                                  -- e.g. "chat", "getrennt", "liste"
  caption       text,
  scheduled_for timestamptz,
  blotato_id    text,
  post_id       text references public.klar_posts(post_id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (handle, name)
);

create index if not exists klar_routine_posts_app_idx on public.klar_routine_posts (app_slug, scheduled_for desc);

alter table public.klar_routines enable row level security;
alter table public.klar_routine_posts enable row level security;

-- The four routines as they ran on 2026-11-09 (TAGESROUTINE.md).
insert into public.klar_routines (app_slug, accounts, slots, credits, run_at) values
  ('learnbound', '[{"handle": "studywithji.a", "blotato_id": "62350"}]', '{13:00,18:00,22:00}', 6, '06:30'),
  ('pocketmate', '[{"handle": "mylooame00l", "blotato_id": "62314"}]', '{13:00,18:00,22:00}', 3, '07:30'),
  ('basalt', '[{"handle": "motivationwithbasalt", "blotato_id": "46401"}, {"handle": "basaltapp_de", "blotato_id": "62313"}]',
   '{10:00,13:00,18:00,22:00}', 1, '08:30'),
  ('kelva', '[{"handle": "bris_selfcare", "blotato_id": "48103"}]', '{10:00,13:00,18:00,22:00}', 7, '09:30')
on conflict (app_slug) do nothing;
