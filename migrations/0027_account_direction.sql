-- Die Richtung eines Kanals, mit Verlauf statt Überschreiben.
--
-- Bisher stand die Richtung in `klar_account_status.format` — ein Freitextfeld
-- mit genau einem `updated_at`. Beides ist das Problem:
--
-- 1. FREITEXT DRIFTET. Stand 2026-08-20 trugen 16 gefüllte Zeilen unter
--    anderem `Talking Head/ X-Format`, `Talking Head X Format ausnutzen!` und
--    `Auch wieder Talking Head Format hier!` — dreimal dieselbe Richtung, nie
--    zählbar. Fünf weitere Zellen trugen überhaupt keine Richtung, sondern
--    einen Verweis auf einen anderen Kanal (`Gleicher Content wie
--    onwavelength`) oder ein fremdes Konto (`Hier henrylove-Format abusen`).
--
-- 2. EIN `updated_at` LÖSCHT DIE GESCHICHTE. Wer die Richtung wechselt, nimmt
--    der Zeile, was vorher dort stand. Danach ist nicht mehr beantwortbar, was
--    ein Kanal schon probiert hat und warum es aufgehört wurde. Akut bei
--    `basalt:tiktok:realone9947`: Richtung Slideshow seit 08-19, in der Notiz
--    steht „nicht wirklich vielversprechend leider" — der Wechsel steht an, und
--    mit ihm verschwände spurlos, dass Slideshow überhaupt versucht wurde.
--
-- Deshalb eine eigene Tabelle mit einer Zeile je Kanal UND Richtungswechsel.
-- Die laufende Richtung ist die mit `bis is null`; „neu orientieren" schliesst
-- die alte mit `bis = heute` plus Grund und legt die neue an. Nichts wird
-- überschrieben.
--
-- ZUR KEHRTWENDE GEGEN 0019: dort stand ausdrücklich „Freitext mit Vorschlägen
-- statt fester Liste … eine Auswahl, die das gewünschte Format nicht enthält,
-- führt nur dazu, dass jemand Sonstiges nimmt". Nach vier Monaten Bestand ist
-- das Gegenteil eingetreten: niemand nahm „Sonstiges", alle schrieben dieselbe
-- Richtung anders auf. Die Liste ist bewusst kurz und aus dem Bestand
-- abgeleitet, nicht ausgedacht — `Talking Head` (8 Zeilen), `Slideshow` (2),
-- `Empfehlungen` (1). Ergänzen heisst: hier UND in `lib/accountStates.ts`
-- (`DIRECTIONS`) nachziehen, so wie `state` es seit 0017 hält.
--
-- `referenz` zeigt auf die Kennung aus dem Vault-Manifest
-- (`Projects/00-Referenzen.md`, Form `<projekt>/<id>`, etwa
-- `klar-content-pipeline/04-pov-lockedin-lovora`). Absichtlich nur Text und
-- kein Fremdschlüssel: die Referenzvideos liegen als Dateien im AI-Brain und
-- auf Drive, nicht in dieser Datenbank. Ein FK würde eine Herkunft behaupten,
-- die es hier nicht gibt.
--
-- `spiegelt` ersetzt die Prosa-Verweise. Ein Kanal, der einen anderen kopiert,
-- nennt dessen `account_key`; ändert sich die Quelle, ist im Board sichtbar,
-- wer mitzieht.
--
-- service-role only (keine Policies), gleiches RLS-Muster wie klar_account_status.

create table if not exists public.klar_account_direction (
  id bigint generated always as identity primary key,
  account_key text not null,
  richtung text not null
    check (richtung in ('Talking Head', 'Slideshow', 'Empfehlungen')),
  referenz text,
  spiegelt text,
  ab date not null default current_date,
  bis date,
  grund text,
  created_at timestamptz not null default now(),
  -- Eine Richtung kann nicht enden, bevor sie angefangen hat.
  constraint klar_account_direction_zeitraum check (bis is null or bis >= ab)
);

-- Je Kanal höchstens EINE laufende Richtung. Das ist die Regel, an der das
-- Board hängt: es zeigt `bis is null`, und zwei davon wären nicht anzeigbar.
create unique index if not exists klar_account_direction_laufend
  on public.klar_account_direction (account_key)
  where bis is null;

-- Der Verlauf je Kanal, neueste zuerst — die einzige andere Abfrage, die es gibt.
create index if not exists klar_account_direction_verlauf
  on public.klar_account_direction (account_key, ab desc);

comment on table public.klar_account_direction is
  'Richtung je Kanal MIT VERLAUF: eine Zeile je Kanal und Richtungswechsel. Laufend = bis is null. Ersetzt das Freitextfeld klar_account_status.format, das beim Wechsel überschrieben wurde. Service-role only (RLS no-policy).';
comment on column public.klar_account_direction.richtung is
  'Kontrolliertes Vokabular, siehe check und DIRECTIONS in lib/accountStates.ts. Beide zusammen ergänzen.';
comment on column public.klar_account_direction.referenz is
  'Kennung aus Projects/00-Referenzen.md im AI-Brain, Form <projekt>/<id>. Kein Fremdschlüssel: die Dateien liegen nicht in dieser Datenbank.';
comment on column public.klar_account_direction.spiegelt is
  'account_key des Kanals, dessen Richtung übernommen wird. Ersetzt Prosa wie „Gleicher Content wie onwavelength".';
comment on column public.klar_account_direction.grund is
  'Warum gewechselt wurde. Wird beim Schliessen der alten Zeile gesetzt, nicht beim Anlegen der neuen.';

alter table public.klar_account_direction enable row level security;
-- keine anon/auth policies -> nur service-role (die Admin-Server-Routen).

-- ---------------------------------------------------------------------------
-- Bestand übernehmen.
--
-- Übernommen wird NUR, was eindeutig eine Richtung ist. Die Zuordnung ist eine
-- Normalisierung der Schreibweisen, keine Deutung:
--   'Talking Head%'  -> Talking Head   (5 Zeilen wörtlich + 2 Varianten)
--   '%Talking Head%' -> Talking Head   (`Auch wieder Talking Head Format hier!`)
--   'Slideshow%'     -> Slideshow      (`Slideshow`, `Slideshow/ Videocontent`)
--   'Empfehlungen'   -> Empfehlungen
--
-- NICHT übernommen und mit Absicht liegen gelassen, weil es Deutung wäre:
--   basalt:tiktok:girlysgirl78   `Gleicher Content wie onwavelength…` — es gibt
--       zwei onwavelength-Kanäle, einer davon aufgegeben. Welcher gemeint ist,
--       entscheidet Alain über das Feld `spiegelt`.
--   myloo:instagram:mylooapp     `Hier henrylove-Format abusen` — henrylove ist
--       ein fremdes Konto, kein Kanal von uns. Das ist eine Referenz, keine
--       Spiegelung, und das Video steht noch in keinem Manifest.
--   trubel:youtube:trubelapp     `Exakt gleiche Strategie wie Tiktok!` — meint
--       erkennbar trubel:tiktok:theappforevents, aber „gleiche Strategie" ist
--       nicht dasselbe wie „gleiche Richtung".
--   trubel:tiktok:theappforevents `ProjectX Feel Good Content/ Und 1 mal pro
--       Tag Content wo das` — abgeschnittener Satz, keine Richtung.
--   basalt:instagram:onwavelength14 `Pornos-Quitten!` — das ist die Nische,
--       sie steht in `niche` nochmal.
--
-- `klar_account_status.format` bleibt stehen und wird NICHT geleert. Das Board
-- schreibt nicht mehr hinein, zeigt den Altwert aber weiter an, solange er von
-- der laufenden Richtung abweicht — sonst verschwände beim Umstellen genau das,
-- was diese Migration bewahren soll.
insert into public.klar_account_direction (account_key, richtung, ab)
select
  s.account_key,
  case
    when s.format ilike '%talking head%' then 'Talking Head'
    when s.format ilike 'slideshow%'     then 'Slideshow'
    when s.format = 'Empfehlungen'       then 'Empfehlungen'
  end as richtung,
  coalesce(s.updated_at::date, current_date) as ab
from public.klar_account_status s
where s.format is not null
  and (
    s.format ilike '%talking head%'
    or s.format ilike 'slideshow%'
    or s.format = 'Empfehlungen'
  )
on conflict do nothing;
