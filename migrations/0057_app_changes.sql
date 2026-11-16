-- klar_app_changes: the change log of each app (Alain, 2026-11-16: "oben sieht man immer Änderungen, welche
-- gemacht worden sind"). One line per change to onboarding, paywall, price or store page, listed above the
-- conversion graphs on /admin/conversion and marked in them. Written there by hand, or by an agent with a
-- plain insert (via = 'agent').
--
-- app_slug is the PostHog `app` value (basalt, kelva), not klar_creator_apps.slug (Basalt is 'wavelength' there).
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role only (no policies).

create table if not exists public.klar_app_changes (
  id          uuid primary key default gen_random_uuid(),
  app_slug    text not null check (app_slug ~ '^[a-z0-9-]{1,40}$'),
  happened_on date not null,
  text        text not null check (char_length(btrim(text)) between 1 and 200),
  via         text not null default 'dashboard' check (via in ('dashboard', 'agent')),
  created_at  timestamptz not null default now()
);
create index if not exists klar_app_changes_app_day on public.klar_app_changes (app_slug, happened_on desc);

alter table public.klar_app_changes enable row level security;
revoke all on public.klar_app_changes from public, anon, authenticated;
grant all on public.klar_app_changes to service_role;
