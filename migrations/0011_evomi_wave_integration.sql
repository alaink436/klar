-- Evomi-Wave full integration (S75). Two additive changes to the Klar-Hub
-- (exiuwektrqxvycclqfdd), both service-role only (mirror of klar_outreach_* RLS):
--
--  1) klar_scrape_settings.wave_backend — the production scrape backend switch.
--     'n8n'   = legacy path: /admin/outreach/start fires the n8n webhook (default,
--               so nothing changes until an admin flips it).
--     'evomi' = in-app path: start enqueues candidates, the cron drains enrichment
--               (TikTok via Evomi, Instagram via the Apify profile scraper).
--
--  2) klar_wave_candidates — the per-handle work queue the cron drains N-per-tick,
--     so a real-size wave (e.g. 50 profiles) never blocks the Vercel function limit.
--     One row per (run, platform, handle); cascade-deletes with its run.

-- 1) backend switch on the singleton settings row -----------------------------
alter table public.klar_scrape_settings
  add column if not exists wave_backend text not null default 'n8n'
    check (wave_backend in ('n8n', 'evomi'));

-- 2) candidate work-queue -----------------------------------------------------
create table if not exists public.klar_wave_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.klar_outreach_runs(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram')),
  handle text not null,
  app text not null,
  niche text,
  language text not null default 'de',
  size_buckets text[] not null default '{}',
  follower_min int not null default 0,
  follower_max int not null default 1000000000,
  -- pending -> claimed -> done | dropped | error. 'dropped' = enriched but failed
  -- a filter (follower range / no email); 'error' = enrichment itself failed.
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'done', 'dropped', 'error')),
  attempts int not null default 0,
  result_note text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  unique (run_id, platform, handle)
);

-- Drain order: oldest pending first, scoped by status. Also covers the
-- per-run "anything still pending?" check that decides when a run is done.
create index if not exists klar_wave_candidates_drain
  on public.klar_wave_candidates (status, created_at);
create index if not exists klar_wave_candidates_by_run
  on public.klar_wave_candidates (run_id, status);

alter table public.klar_wave_candidates enable row level security;
-- no anon/auth policies -> service-role only, same as klar_outreach_suppressions.
