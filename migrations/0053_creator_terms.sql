-- Creator terms (Alain 2026-10-22: accepted "wenn man die erste Abhebung macht"): when the creator ticked "I agree to the
-- creator terms" with his first Wise details. Null for everyone who never asked for a payout.
alter table public.klar_creator_accounts
  add column if not exists terms_accepted_at timestamptz;
