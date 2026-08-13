-- Wo das Material liegt.
--
-- Das Board sagt bisher, WAS heute rausgeht (Format) und ob es raus ist
-- (Haken) — aber nicht, woher man die Datei nimmt. Genau daran hängt der
-- Handbetrieb: Ordner suchen, im Drive kramen, im falschen Projekt landen.
-- Also ein Feld pro Account, das die Anweisung trägt: Pfad, Drive-Ordner,
-- Link, oder zwei Sätze wie man dorthin kommt.
--
-- Freitext und mehrzeilig, kein Pfad-Typ: die Quellen sind lokale Ordner,
-- rclone-Ziele und Links durcheinander, und eine Struktur, die das erzwingen
-- wollte, würde bloss umgangen.
alter table public.klar_account_status
  add column if not exists material text;

comment on column public.klar_account_status.material is
  'Wo das Material für diesen Account liegt — Ordner, Drive, Link, oder die zwei Sätze, wie man hinkommt. Erscheint in der Tagesliste, wo es beim Posten gebraucht wird.';
