-- Creators who sign up and never post (Alain 2026-10-24: "eine Warnemail, und danach kicken wir sie automatisch raus").
-- lib/creatorInactive: 7 days without a counted post -> warning mail, stamped here; 3 days after it still nothing -> the
-- account is closed like after three strikes, with the reason, so the dashboard can say why.
alter table public.klar_creator_accounts
  add column if not exists inactive_warned_at timestamptz,
  add column if not exists closed_reason text;
