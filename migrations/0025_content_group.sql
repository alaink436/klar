-- Verbund: welche Kanäle denselben Content tragen.
--
-- Auf mehreren Accounts geht dasselbe Material raus — dieselbe Slideshow auf
-- dem Brand-Account und auf dem Zweitaccount, derselbe Talking-Head auf X und
-- auf Instagram. Bisher stand das nur in Notizen („Gleiches wie
-- vladimirdimitriev4219. Copy Paste"), also an einer Stelle, die die Tagesliste
-- nicht liest. Damit sah man beim Posten nicht, dass zwei Zeilen dieselbe
-- Arbeit sind.
--
-- Ein freier Name statt einer Verknüpfungstabelle: der Verbund ist eine
-- Benennung („Basalt Talking Head"), keine Beziehung mit eigenen Feldern. Wer
-- denselben Namen einträgt, ist verbunden — und wer ihn leert, ist es nicht
-- mehr. Das kostet keine zweite Tabelle und keine Waisen beim Umbenennen.
alter table public.klar_account_status
  add column if not exists content_group text;

comment on column public.klar_account_status.content_group is
  'Posting-Board: Name des Content-Verbunds. Accounts mit demselben Namen posten dasselbe Material — die Tagesliste zeigt es an jedem Post an. Leer = eigener Content.';
