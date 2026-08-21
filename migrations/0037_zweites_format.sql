-- Ein Kanal darf zwei Richtungen gleichzeitig fahren.
--
-- 0027 hat das ausdrücklich verboten:
--
--   "Je Kanal höchstens EINE laufende Richtung. Das ist die Regel, an der das
--    Board hängt: es zeigt `bis is null`, und zwei davon wären nicht anzeigbar."
--
-- Das war richtig, solange eine Richtung eine Wette war, die man gewinnt oder
-- abbricht. Seit 2026-08-21 ist es das nicht mehr. Ein generierter Spot kostet
-- Credits bei einem Anbieter, dessen Abo endlich ist; Alain will deshalb neben
-- dem teuren Format ein günstiges MITLAUFEN lassen, nicht es ersetzen. Beides
-- gleichzeitig zu fahren ist der Sinn der Sache, nicht ein Zustand, den man
-- schnell wieder auflöst.
--
-- Zwei Wege standen zur Wahl:
--
--   (a) Den Unique-Index ersatzlos streichen und beliebig viele laufende
--       Richtungen erlauben.
--   (b) Einen Steckplatz einführen und je Kanal und Platz höchstens eine
--       laufende Richtung erlauben.
--
-- Es wird (b). Bei (a) hätte die Anzeige keine stabile Reihenfolge mehr — zwei
-- Zeilen ohne Rangfolge stehen mal so, mal so, und das Board ist eine Tabelle,
-- die man überfliegt. Ausserdem wächst (a) unbegrenzt, und eine Kanalzeile mit
-- fünf Richtungen ist genau das, was 0027 verhindern wollte. Der Steckplatz
-- behält die Invariante „ein Platz, eine laufende Zeile", von der `reorient()`
-- lebt, und macht die Reihenfolge zu Daten statt zu Zufall.
--
-- Platz 1 ist das Hauptformat, Platz 2 das mitlaufende. Die Bedeutung steckt
-- nicht im Code, sondern in der Anzeige: Platz 1 steht oben. Wer Platz 1
-- aufgibt und Platz 2 behält, schliesst Platz 1 — Platz 2 rutscht NICHT nach.
-- Das ist Absicht: sonst änderte sich rückwirkend, was ein Verlaufseintrag
-- bedeutet.
--
-- Warum `smallint` mit Check und nicht ein Enum: erweitern auf drei Plätze ist
-- dann eine Zeile hier und eine in `lib/accountStates.ts`, ohne Typ-Migration.
-- Zwei ist die heutige Anforderung, nicht die Obergrenze der Idee.

alter table public.klar_account_direction
  add column if not exists slot smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.klar_account_direction'::regclass
      and conname = 'klar_account_direction_slot'
  ) then
    alter table public.klar_account_direction
      add constraint klar_account_direction_slot check (slot in (1, 2));
  end if;
end $$;

-- Der alte Index verbot die zweite laufende Zeile. Er geht, und der neue nimmt
-- den Steckplatz mit auf: je Kanal UND Platz weiterhin höchstens eine laufende.
drop index if exists public.klar_account_direction_laufend;

create unique index if not exists klar_account_direction_laufend_slot
  on public.klar_account_direction (account_key, slot)
  where bis is null;

-- Der Verlauf wird jetzt auch je Platz gelesen (das Board klappt beide
-- getrennt auf), deshalb der Platz mit im Index.
create index if not exists klar_account_direction_verlauf_slot
  on public.klar_account_direction (account_key, slot, ab desc);

comment on column public.klar_account_direction.slot is
  'Steckplatz: 1 = Hauptformat, 2 = mitlaufendes Format. Je Kanal und Platz hoechstens eine laufende Zeile (bis is null). Ersetzt die Regel aus 0027, die nur EINE laufende Richtung je Kanal erlaubte, weil seit 2026-08-21 ein guenstiges Format neben einem teuren mitlaufen soll statt es abzuloesen.';

comment on table public.klar_account_direction is
  'Richtung je Kanal MIT VERLAUF: eine Zeile je Kanal, Steckplatz und Richtungswechsel. Laufend = bis is null. Platz 1 ist das Hauptformat, Platz 2 laeuft daneben mit. Service-role only (RLS no-policy), Schreibschutz siehe klar_nur_ueber_das_board() aus 0028.';
