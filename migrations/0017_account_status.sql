-- Der von Hand gepflegte Teil der Account-Landkarte, für den Bestand-Tab auf
-- /admin/content.
--
-- Bewusst schmal: hier steht NUR, was keine Plattform und keine API wissen
-- kann. Alles andere bleibt abgeleitet und wird nicht zweimal gepflegt —
--   welche Accounts es gibt        -> lib/socialAccounts.ts (ACCOUNTS)
--   wie viele Posts draufliegen    -> das öffentliche Profil (lib/contentWarmup)
--   ob die Pipeline posten kann    -> Blotato-Verbindung (reconcile())
--   Follower/Likes                 -> Handmessung in socialAccounts
-- Was übrig bleibt, ist eine Entscheidung: läuft der Account, wärmt er auf,
-- pausiert er, oder ist er aufgegeben — und warum.
--
-- `account_key` ist accountKey() aus lib/socialAccounts ("app:platform:handle").
-- Wird ein Handle umbenannt, verliert die Zeile ihren Anschluss; das ist der
-- Preis dafür, dass die Account-Liste im Code die Wahrheit bleibt und die
-- Datenbank nur die Meinung dazu hält.
--
-- `posts_manual` ist der Ausweg für X: dort gibt es keinen Scrape, also zählt
-- der Mensch. Wo das Profil lesbar ist, gewinnt die gemessene Zahl.
--
-- service-role only (keine Policies), gleiches RLS-Muster wie klar_todos.
create table if not exists public.klar_account_status (
  account_key text primary key,
  state text not null default 'active'
    check (state in ('active', 'warmup', 'paused', 'dropped')),
  target_per_week smallint check (target_per_week >= 0 and target_per_week <= 100),
  posts_manual integer check (posts_manual >= 0),
  note text,
  updated_at timestamptz not null default now()
);

comment on table public.klar_account_status is
  'Bestand-Tab auf /admin/content: der von Hand gepflegte Zustand je Social-Account (aktiv/warmup/pausiert/aufgegeben + Soll + Notiz). Abgeleitete Zahlen (Postzahl, Automatisierung, Follower) stehen bewusst NICHT hier. Service-role only (RLS no-policy).';

alter table public.klar_account_status enable row level security;
-- keine anon/auth policies -> nur service-role (die Admin-Server-Routen).
