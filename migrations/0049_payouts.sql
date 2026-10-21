-- klar_payouts + Wise details on the creator account: the monthly payout of
-- what creators earned (spec Projects/Klar/specs/creator-plattform, ticket 06;
-- lib/payouts).
--
-- What a creator is owed = payable_cents of his closed months in
-- klar_creator_earnings (after the cap, rejected posts never in it) minus
-- every payout that did not fail. From 25 USD he enters his Wise details and
-- the amount shows on the payout list in Klar Control; below it carries over.
-- Alain approves each payout, the app then creates the Wise recipient (once),
-- a quote and a transfer. Wise does not let a personal token fund transfers in
-- Europe, so Alain funds the transfer in the Wise app.
--
-- klar_payouts.status:
--   sending  row written, Wise calls running (a crash leaves it here, Alain
--            checks in Wise before approving again)
--   sent     transfer created in Wise (`wise_transfer_id`), to be funded there
--   failed   Wise refused (`error`); the amount is owed again
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies). Applied via the Management API (2026-10-21).

alter table public.klar_creator_accounts
  add column if not exists wise_email text,
  add column if not exists wise_name text,
  add column if not exists wise_recipient_id bigint;

create table if not exists public.klar_payouts (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid references public.klar_creator_accounts(id) on delete set null,
  handle           text not null,
  amount_cents     integer not null check (amount_cents > 0),
  through_month    date not null,
  status           text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  wise_transfer_id bigint,
  error            text,
  created_at       timestamptz not null default now()
);

create index if not exists klar_payouts_creator on public.klar_payouts (creator_id);

alter table public.klar_payouts enable row level security;
