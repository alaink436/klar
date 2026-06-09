-- Singleton settings row for the outreach scraper. Read by the Next admin
-- (Scrape-Einstellungen tab) AND by the n8n Wave-Consumer (Build-Job-List) to
-- pick the backend actor + clamp the per-wave profile count. service-role only
-- (mirror of klar_outreach_* RLS, migration 0005). Already applied to
-- exiuwektrqxvycclqfdd via MCP migration `klar_scrape_settings` (2026-06-09).
create table if not exists public.klar_scrape_settings (
  id boolean primary key default true,
  tiktok_backend       text not null default 'apify'
    check (tiktok_backend in ('apify','selfhost')),
  instagram_backend    text not null default 'apify'
    check (instagram_backend in ('apify','selfhost')),
  max_profiles_per_wave int not null default 30
    check (max_profiles_per_wave between 5 and 200),
  selfhost_enabled     boolean not null default false,
  proxy_provider       text not null default 'none'
    check (proxy_provider in ('iproyal','dataimpulse','none')),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint klar_scrape_settings_singleton check (id = true)
);

alter table public.klar_scrape_settings enable row level security;
-- no anon/auth policies -> service-role only, same as klar_outreach_suppressions.

insert into public.klar_scrape_settings (id) values (true)
  on conflict (id) do nothing;  -- seed the singleton with defaults
