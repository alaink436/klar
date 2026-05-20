-- Klar generic Affiliate-Payout schema, version 1.
--
-- Applied identically to each Klar-App Supabase project so that /admin can
-- query every app over the same shape (see klar/src/app/admin/route.ts).
-- Wise is the payout rail; the wise-dispatch / wise-reconcile Edge Functions
-- (separate file, deployed per app) move money against this schema.
--
-- Conventions:
--   * Money is stored in cents.
--   * EUR is the reporting currency. share_cents_eur is the influencer's
--     fixed share after FX, gross_revenue_cents is whatever currency the
--     event landed in (so a NULL share_cents_eur means "unnormalized, FX
--     conversion pending").
--   * RLS is on with no policies. Reads/writes only via service-role key
--     (Klar /admin + each app's webhook). Anon and authenticated roles get
--     nothing. This is intentional — Klar is the single payment authority,
--     no app user should ever touch these rows.

-- Required for gen_random_uuid().
create extension if not exists pgcrypto;

-- ============================================================
-- 1. influencers
-- ============================================================
-- One row per affiliate sign-up. handle is the public referral code
-- (uppercased on insert from the influencer_codes side). status drives the
-- payout eligibility: only "active" influencers get rolled into batches.
create table if not exists public.influencers (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  email text,
  status text not null default 'active' check (status in ('active','pending','suspended','banned')),
  payout_method text default 'wise',
  wise_recipient_id text,
  share_percent numeric(5,2) not null default 50.00,
  source_app text,            -- yarn-stash, kelva, ...
  signup_domain text,         -- yarn-stash.app, kelva.space, ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists influencers_status_idx on public.influencers (status);
create index if not exists influencers_handle_lower_idx on public.influencers (lower(handle));

-- Updated_at trigger: keep updated_at fresh on UPDATE.
create or replace function public._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_influencers_touch on public.influencers;
create trigger trg_influencers_touch
  before update on public.influencers
  for each row execute function public._touch_updated_at();

-- ============================================================
-- 2. referral_revenue_events
-- ============================================================
-- Append-only ledger. Every Awin/RevenueCat/manual conversion lands here as
-- one row. share_cents_eur NULL means FX still needed (the unnormalized_events
-- counter on the claimable view).
create table if not exists public.referral_revenue_events (
  id bigserial primary key,
  influencer_id uuid references public.influencers (id) on delete set null,
  influencer_handle text,
  event_at timestamptz not null default now(),
  source text not null,                -- "awin", "revenuecat", "manual"
  source_ref text,                     -- external id (awin_transaction_id, rc event id)
  gross_revenue_cents bigint,          -- raw, original currency
  gross_currency text,                 -- ISO 4217, e.g. "USD"
  share_cents_eur bigint,              -- normalized to EUR. NULL = FX pending
  matured_at timestamptz,              -- when refund window closed (null = pending)
  refunded boolean not null default false,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists revenue_events_influencer_idx on public.referral_revenue_events (influencer_id, event_at desc);
create index if not exists revenue_events_event_at_idx on public.referral_revenue_events (event_at desc);
create index if not exists revenue_events_source_idx on public.referral_revenue_events (source);

-- ============================================================
-- 3. influencer_payout_batches
-- ============================================================
-- One batch = one monthly disbursement. pg_cron (or a Klar-side function)
-- rolls matured, non-refunded events into a batch and flips status to
-- "awaiting_release", then the admin clicks "Via Wise vorbereiten" which
-- POSTs the batch to wise-dispatch.
create table if not exists public.influencer_payout_batches (
  id bigserial primary key,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft','awaiting_release','dispatched','paid','failed','cancelled')),
  item_count integer not null default 0,
  total_amount_cents bigint not null default 0,
  wise_quote_id text,
  dispatched_at timestamptz,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_batches_status_idx on public.influencer_payout_batches (status, created_at desc);
create index if not exists payout_batches_period_idx on public.influencer_payout_batches (period_start, period_end);

drop trigger if exists trg_batches_touch on public.influencer_payout_batches;
create trigger trg_batches_touch
  before update on public.influencer_payout_batches
  for each row execute function public._touch_updated_at();

-- ============================================================
-- 4. influencer_payout_items
-- ============================================================
-- Per-influencer slice of a batch. provider_ref holds the Wise transfer id
-- once dispatched. status mirrors Wise state: queued → processing → paid /
-- failed. We keep one row per (batch, influencer).
create table if not exists public.influencer_payout_items (
  id bigserial primary key,
  batch_id bigint not null references public.influencer_payout_batches (id) on delete cascade,
  influencer_id uuid references public.influencers (id) on delete set null,
  influencer_handle text not null,
  amount_cents bigint not null,
  payout_method text not null default 'wise',
  status text not null default 'queued'
    check (status in ('queued','dispatched','processing','paid','failed','cancelled')),
  provider_ref text,
  provider_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, influencer_handle)
);

create index if not exists payout_items_batch_idx on public.influencer_payout_items (batch_id);
create index if not exists payout_items_status_idx on public.influencer_payout_items (status);

drop trigger if exists trg_items_touch on public.influencer_payout_items;
create trigger trg_items_touch
  before update on public.influencer_payout_items
  for each row execute function public._touch_updated_at();

-- ============================================================
-- 5. influencer_claimable (view)
-- ============================================================
-- Per-influencer aggregate that /admin reads in appView(). matured = sum of
-- EUR shares for matured (non-refunded) events. paid = sum of items in state
-- "paid". claimable = matured - paid. unnormalized = count of events that
-- still need FX before they can roll into a batch.
create or replace view public.influencer_claimable as
  select
    i.id                              as influencer_id,
    i.handle                          as handle,
    i.status                          as status,
    i.payout_method                   as payout_method,
    coalesce(sum(
      case
        when e.matured_at is not null and e.refunded is false then e.share_cents_eur
      end
    ), 0)::bigint                     as matured_share_eur_cents,
    coalesce((
      select sum(p.amount_cents)
      from public.influencer_payout_items p
      where p.influencer_id = i.id and p.status = 'paid'
    ), 0)::bigint                     as paid_eur_cents,
    coalesce(sum(
      case
        when e.matured_at is not null and e.refunded is false then e.share_cents_eur
      end
    ), 0)::bigint
    - coalesce((
      select sum(p.amount_cents)
      from public.influencer_payout_items p
      where p.influencer_id = i.id and p.status = 'paid'
    ), 0)::bigint                     as claimable_eur_cents,
    coalesce(sum(
      case when e.share_cents_eur is null then 1 else 0 end
    ), 0)::bigint                     as unnormalized_events
  from public.influencers i
  left join public.referral_revenue_events e on e.influencer_id = i.id
  group by i.id, i.handle, i.status, i.payout_method;

-- ============================================================
-- 6. RLS + lockdown
-- ============================================================
alter table public.influencers              enable row level security;
alter table public.referral_revenue_events  enable row level security;
alter table public.influencer_payout_batches enable row level security;
alter table public.influencer_payout_items  enable row level security;

-- No policies. Service-role bypasses RLS. anon/authenticated get nothing.
revoke all on public.influencers              from public, anon, authenticated;
revoke all on public.referral_revenue_events  from public, anon, authenticated;
revoke all on public.influencer_payout_batches from public, anon, authenticated;
revoke all on public.influencer_payout_items  from public, anon, authenticated;
revoke all on public.influencer_claimable     from public, anon, authenticated;

-- Function lockdown (touch_updated_at is a trigger, no need to expose it).
revoke all on function public._touch_updated_at() from public, anon, authenticated;

comment on table public.influencers is 'Klar Affiliate registry. Service-role only, RLS-locked.';
comment on table public.referral_revenue_events is 'Append-only ledger of attributed conversions, EUR-normalized.';
comment on table public.influencer_payout_batches is 'Monthly batch headers. Status drives the Wise-dispatch workflow.';
comment on table public.influencer_payout_items is 'Per-influencer line items inside a batch, with Wise transfer refs.';
comment on view public.influencer_claimable is 'Per-influencer aggregate read by /admin appView.';
