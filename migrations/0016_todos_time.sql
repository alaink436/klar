-- Uhrzeit zur Tagesplanung. Getrennt von `due_on` und bewusst NULLable:
-- null = ganztägig ("irgendwann an dem Tag"), gesetzt = fester Zeitpunkt.
--
-- `time without time zone` und nicht `timestamptz`: gespeichert wird die Zeit,
-- die Alain im Planer sieht — Ortszeit Zürich. Erst der Kalender-Feed rechnet
-- sie für den konkreten Tag nach UTC um (Sommer-/Winterzeit hängt am Datum,
-- nicht am Wert). Ein `timestamptz` würde diese Umrechnung beim SPEICHERN
-- festnageln und beim Verschieben über eine Zeitumstellung hinweg falsch.
alter table public.klar_todos
  add column if not exists due_time time;

-- Innerhalb eines Tages: erst die terminierten Punkte nach Uhrzeit, dann die
-- ganztägigen. `nulls last` sortiert "ohne Uhrzeit" ans Ende des Tages.
create index if not exists klar_todos_day_idx
  on public.klar_todos (due_on, due_time nulls last)
  where done = false;
