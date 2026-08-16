-- Konto: welche Kanäle zusammengehören und deshalb denselben Content tragen.
--
-- Sprachregelung (Alain, 2026-08-16): eine Zeile im Board ist ein **Kanal**,
-- mehrere Kanäle gehören zu einem **Konto**. Die Spalte heisst trotzdem
-- `content_group` — `account_*` bezeichnet im Code seit `lib/socialAccounts`
-- die einzelne Zeile (`account_key`), und derselbe Bezeichner für zwei Dinge
-- wäre schlimmer als eine Spalte, deren Name die Oberfläche nicht spiegelt.
--
-- Auf mehreren Kanälen geht dasselbe Material raus — dieselbe Slideshow auf
-- dem Brand-Kanal und auf dem Zweitkanal, derselbe Talking-Head auf X und auf
-- Instagram. Bisher stand das nur in Notizen („Gleiches wie
-- vladimirdimitriev4219. Copy Paste"), also an einer Stelle, die die Tagesliste
-- nicht liest. Damit sah man beim Posten nicht, dass zwei Zeilen dieselbe
-- Arbeit sind.
--
-- Ein freier Name statt einer Verknüpfungstabelle: das Konto ist eine Benennung
-- („girlysgirl78"), keine Beziehung mit eigenen Feldern. Wer denselben Namen
-- einträgt, gehört dazu — und wer ihn leert, gehört nicht mehr dazu. Das kostet
-- keine zweite Tabelle und keine Waisen beim Umbenennen.
alter table public.klar_account_status
  add column if not exists content_group text;

comment on column public.klar_account_status.content_group is
  'Posting-Board: Name des KONTOS, zu dem der Kanal gehört (so heisst das Feld in der Oberfläche). Kanäle mit demselben Namen posten dasselbe Material — die Tagesliste zeigt es an jedem Post. Leer = eigener Content. Spaltenname bleibt content_group, weil account_* im Code schon die einzelne Zeile bezeichnet.';
