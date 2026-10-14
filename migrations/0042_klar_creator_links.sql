-- klar_creator_apps + klar_creator_links: die Apps und ihre Creators fuer
-- /admin/creators und die Kurzlinks getklar.org/<short_path>/<handle>
-- (Alain, 2026-10-14: "Apps erstellen, bestehende sehen, Creators zuordnen,
-- markiert, ob die App Detour hat").
--
-- Bis heute standen die Creators in `influencers` der jeweiligen App-Supabase,
-- und nur Basalt hatte die Tabelle in brauchbarer Form. Hier stehen sie fuer
-- jede App an einer Stelle; gezaehlt wird weiter in `referrals` der App, sofern
-- sie Detour hat und in KLAR_ADMIN_APPS verbunden ist (`backend_slug`).
--
-- Entfernen setzt `removed_at`: der Kurzlink geht nicht mehr, wer ueber ihn kam,
-- bleibt ihm zugeordnet, und erneutes Anlegen holt dieselbe Zeile zurueck.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies). Applied via MCP migration `klar_creator_links` (2026-10-14).

create table if not exists public.klar_creator_apps (
  slug         text primary key,                 -- stabile Kennung, z.B. "basalt"
  name         text not null,
  short_path   text not null unique,             -- getklar.org/<short_path>/<handle>
  detour_link  text,                             -- null = App hat (noch) kein Detour
  store_url    text,                             -- Ziel des Kurzlinks ohne Detour
  backend_slug text,                             -- Eintrag in KLAR_ADMIN_APPS, fuer die Zaehlung
  created_at   timestamptz not null default now()
);

create table if not exists public.klar_creator_links (
  id         uuid primary key default gen_random_uuid(),
  app_slug   text not null references public.klar_creator_apps(slug) on update cascade,
  handle     text not null,
  name       text not null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (app_slug, handle)
);

alter table public.klar_creator_apps enable row level security;
alter table public.klar_creator_links enable row level security;

-- Die Apps, die getklar.org heute zeigt (src/app/page.tsx), Store-Links aus src/lib/klarApps.ts.
insert into public.klar_creator_apps (slug, name, short_path, detour_link, store_url, backend_slug) values
  ('basalt',      'Basalt',        'basalt',     'https://klar.godetour.link/Zjm1D8IAwV', 'https://apps.apple.com/app/id6762440839', 'wavelength'),
  ('pocketmate',  'Pocketmate',    'pocketmate', null, 'https://apps.apple.com/app/id6767200261', 'myloo'),
  ('anime-vault', 'Anime Vault',   'animevault', null, 'https://apps.apple.com/app/id6759915617', 'promillio'),
  ('yarn-stash',  'My Yarn Stash', 'yarnstash',  null, 'https://apps.apple.com/app/id6761712550', 'yarn-stash'),
  ('kelva',       'Kelva',         'kelva',      null, 'https://apps.apple.com/app/id6761271923', 'kelva'),
  ('learnbound',  'Learnbound',    'learn',      null, null, null)  -- /learnbound/* sind Universal Links der App
on conflict (slug) do nothing;

-- Die beiden Creators, die bis heute in Basalts `influencers` standen.
insert into public.klar_creator_links (app_slug, handle, name) values
  ('basalt', 'probe', 'Testlauf Basalt'),
  ('basalt', 'tonystark', 'Tony Stark')
on conflict (app_slug, handle) do nothing;
