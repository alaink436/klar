-- klar_model_runs + klar_creator_earnings: the daily estimate behind the
-- commission of creators without a link (spec Projects/Klar/specs/
-- creator-plattform, ticket 05; lib/creatorModel, lib/creatorModelRun).
--
-- klar_model_runs, one row per app and day (the cron overwrites today's):
--   rate_per_1000       sign-ups per 1000 fresh views; `rate_source` says
--                       whether it is the prototype's 0.5 ('prior', fewer than
--                       14 days of view snapshots) or fitted ('fit')
--   baseline_signups,   sign-ups of the current month without any post (hour of
--   actual_signups      day + trend) and what really came
--   revenue_per_signup_cents  RevenueCat revenue of 28 days / new users of 30 days
--   extra_revenue_cents (actual - baseline) x revenue per sign-up; the creators
--   cap_cents           together get at most 40 % of it (`cap_factor` < 1: cut)
--   days                [{d, signups, baseline}] per day of the window, for the
--                       charts in the dashboard and Klar Control
--
-- klar_creator_earnings, one row per creator and month: fresh views of his
-- counted posts, estimated sign-ups and revenue, commission (50 %) and what is
-- payable after the cap. Ticket 06 pays out from it. `days`: [{d, views}].
--
-- klar_creator_accounts.followers comes from the creators' Apify run, for the
-- link suggestion from 1000 followers.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies). Applied via the Management API (2026-10-21).

create table if not exists public.klar_model_runs (
  app_slug                 text not null,
  run_date                 date not null,
  run_at                   timestamptz not null default now(),
  rate_per_1000            double precision not null,
  rate_source              text not null check (rate_source in ('prior', 'fit')),
  fitted_rate_per_1000     double precision,
  days_of_data             integer not null,
  month                    date not null,
  baseline_signups         double precision not null,
  actual_signups           integer not null,
  revenue_per_signup_cents double precision not null,
  extra_revenue_cents      double precision not null,
  cap_cents                double precision not null,
  commission_cents         double precision not null,
  cap_factor               double precision not null,
  days                     jsonb not null default '[]',
  primary key (app_slug, run_date)
);

create table if not exists public.klar_creator_earnings (
  creator_id        uuid not null references public.klar_creator_accounts(id) on delete cascade,
  month             date not null,
  views             bigint not null,
  est_signups       double precision not null,
  est_revenue_cents double precision not null,
  commission_cents  double precision not null,
  payable_cents     integer not null,
  days              jsonb not null default '[]',
  updated_at        timestamptz not null default now(),
  primary key (creator_id, month)
);

alter table public.klar_creator_accounts add column if not exists followers integer;

alter table public.klar_model_runs enable row level security;
alter table public.klar_creator_earnings enable row level security;
