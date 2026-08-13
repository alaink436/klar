-- Einsteuern ist kein Moment, sondern drei Runden.
--
-- Der eine Haken aus 0021 behauptete, der Feed sei „gezogen" — in Wirklichkeit
-- passiert das über mehrere Sitzungen an verschiedenen Tagen, und genau die
-- Zwischenstände waren nicht darstellbar: ein Account nach der ersten Runde sah
-- aus wie einer, der noch gar nichts hatte.
--
-- Jetzt ein Array von Zeitstempeln, höchstens drei — die Länge ist der Stand
-- (2 von 3), und weil jede Runde ihr eigenes Datum trägt, sieht man auch, ob
-- sie über Tage verteilt waren oder alle drei in zehn Minuten. Ein einzelner
-- Zähler hätte das Zweite weggeworfen.
alter table public.klar_account_status
  add column if not exists steered_rounds timestamptz[] not null default '{}';

alter table public.klar_account_status
  drop constraint if exists klar_account_status_steered_rounds_check;
alter table public.klar_account_status
  add constraint klar_account_status_steered_rounds_check
  check (cardinality(steered_rounds) <= 3);

-- Der bisherige Haken bedeutete „fertig eingesteuert", also übernimmt er alle
-- drei Runden mit seinem Zeitstempel. Ihn als eine Runde zu zählen würde eine
-- Aussage abschwächen, die schon getroffen war.
update public.klar_account_status
   set steered_rounds = array[steered_at, steered_at, steered_at]
 where steered_at is not null
   and cardinality(steered_rounds) = 0;

alter table public.klar_account_status
  drop column if exists steered_at;

comment on column public.klar_account_status.steered_rounds is
  'Bis zu drei Zeitstempel: wann der Feed jeweils in die Zielnische gezogen wurde. Länge = Stand (0–3), leer = noch nicht angefangen.';
