-- Tagesplanung für die To-do-Liste: ein Punkt kann auf einen Tag gelegt werden.
--
-- Bewusst `date` und nicht `timestamptz`: geplant wird ein TAG, keine Uhrzeit.
-- Eine Uhrzeit würde die Zeitzonenfrage aufmachen (Server UTC, Alain CH) und
-- im iPhone-Kalender als Termin um 02:00 landen — der Feed schreibt darum
-- ganztägige Einträge (VALUE=DATE), was exakt zu dieser Spalte passt.
alter table public.klar_todos
  add column if not exists due_on date;

-- Der Feed und die Tagesansicht fragen beide "was ist geplant, ältestes zuerst".
create index if not exists klar_todos_due_idx
  on public.klar_todos (due_on)
  where due_on is not null and done = false;
