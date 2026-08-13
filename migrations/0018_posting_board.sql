-- Der Bestand zieht vom Content-Tab auf die To-do-Seite um und wird dort zum
-- Posting-Board: eine Zeile pro Account, sieben Spalten für die Woche, Haken
-- pro Tag. Migration 0017 war einen halben Tag alt und hatte null Zeilen, also
-- wird sie hier ohne Datenverlust umgebaut statt ergänzt.
--
-- Drei Änderungen, jede mit einem Grund:
--
-- 1. `target_per_week` raus, `rhythm` rein. Eine Zahl ("3 mal pro Woche") kann
--    ein Kalender nicht zeichnen — er weiss nicht, an welchen Tagen. Der
--    Rhythmus benennt die Tage (ISO: 1 = Montag … 7 = Sonntag), und die
--    Wochenansicht folgt daraus, ohne dass irgendwer Termine generieren muss.
--
-- 2. `posts_manual` raus. Die Postzahl von Hand zu pflegen war der Notausgang
--    für X; mit einem Haken pro Tag zählt das Board von selbst, und die
--    gemessene Wahrheit steht ohnehin auf der Content-Landkarte.
--
-- 3. `app` / `platform` / `handle` dazu. Bisher stand die Account-Liste
--    ausschliesslich in lib/socialAccounts.ts — ein YouTube-Kanal liess sich
--    also nur per Deploy eintragen. Zeilen MIT diesen Feldern sind selbst
--    angelegt und leben nur hier; Zeilen ohne gehören zu einem Account aus dem
--    Code und tragen nur dessen Zustand.
alter table public.klar_account_status
  drop column if exists target_per_week,
  drop column if exists posts_manual,
  add column if not exists rhythm smallint[] not null default '{}',
  add column if not exists app text,
  add column if not exists platform text,
  add column if not exists handle text;

alter table public.klar_account_status
  drop constraint if exists klar_account_status_rhythm_check;
alter table public.klar_account_status
  add constraint klar_account_status_rhythm_check
  check (rhythm <@ array[1,2,3,4,5,6,7]::smallint[]);

-- Ein Haken: an diesem Tag wurde auf diesem Account gepostet. Bewusst ein Haken
-- pro Tag und nicht pro Post — die Frage, die das Board beantwortet, ist "habe
-- ich meinen Rhythmus gehalten", nicht "wie viele Videos liegen draussen". Wie
-- viele es wirklich sind, liest der Profil-Scraper auf /admin/content.
create table if not exists public.klar_post_log (
  account_key text not null,
  day date not null,
  note text,
  done_at timestamptz not null default now(),
  primary key (account_key, day)
);

comment on table public.klar_post_log is
  'Posting-Board auf /admin/todos: ein Haken je Account und Tag ("gepostet"). Selbstauskunft, keine Messung -- die echte Postzahl kommt vom Profil-Scraper. Service-role only (RLS no-policy).';

create index if not exists klar_post_log_day_idx on public.klar_post_log (day desc);

alter table public.klar_post_log enable row level security;
-- keine anon/auth policies -> nur service-role (die Admin-Server-Routen).
