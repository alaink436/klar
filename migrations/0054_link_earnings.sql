-- Link earnings (Alain 2026-10-22: "jede Anmeldung über den Link zählt exakt, mal Basalts Umsatz pro Anmeldung, davon
-- 50 %"): the sign-ups through a creator's link in the month and his commission on them, written by the daily model run
-- into the same row as the estimate. payable_cents holds both, so lib/payouts pays them without a change.
alter table public.klar_creator_earnings
  add column if not exists link_signups integer not null default 0,
  add column if not exists link_commission_cents double precision not null default 0;
