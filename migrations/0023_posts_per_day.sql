-- Frequenz: wie oft pro Posting-Tag.
--
-- Der Rhythmus sagt, an WELCHEN Tagen gepostet wird — aber nicht, wie oft an
-- so einem Tag. Genau das fehlte, um „zweimal täglich" auszudrücken, und ohne
-- diese Zahl kann auch der Wochenplan nicht wissen, wie viele Punkte ein Tag
-- trägt.
--
-- Zwei Zahlen statt einer zusammengesetzten ("sechs pro Woche"): welche Tage
-- und wie oft sind verschiedene Entscheidungen, und nur getrennt lassen sie
-- sich zeichnen — der Kalender braucht die Tage, die Tagesliste die Anzahl.
alter table public.klar_account_status
  add column if not exists per_day smallint not null default 1;

alter table public.klar_account_status
  drop constraint if exists klar_account_status_per_day_check;
alter table public.klar_account_status
  add constraint klar_account_status_per_day_check
  check (per_day between 1 and 4);

comment on column public.klar_account_status.per_day is
  'Wie viele Posts an einem Tag, an dem dieser Account laut Rhythmus dran ist (1–4).';

-- Der Haken hing bisher am Tag; bei zwei Posts am Tag braucht jeder seinen
-- eigenen. `slot` ist die laufende Nummer innerhalb des Tages und geht in den
-- Primärschlüssel — die bestehenden Haken werden zu Slot 1 und bleiben gültig.
alter table public.klar_post_log
  add column if not exists slot smallint not null default 1;

alter table public.klar_post_log
  drop constraint if exists klar_post_log_pkey;
alter table public.klar_post_log
  add constraint klar_post_log_pkey primary key (account_key, day, slot);

alter table public.klar_post_log
  drop constraint if exists klar_post_log_slot_check;
alter table public.klar_post_log
  add constraint klar_post_log_slot_check check (slot between 1 and 4);

comment on table public.klar_post_log is
  'Posting-Board auf /admin/todos: ein Haken je Account, Tag und Slot ("gepostet"). Selbstauskunft, keine Messung -- die echte Postzahl kommt vom Profil-Scraper. Service-role only (RLS no-policy).';
