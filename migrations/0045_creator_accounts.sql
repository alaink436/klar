-- klar_creator_accounts: the creators who signed up themselves on getklar.org/dashboard
-- (spec Projects/Klar/specs/creator-plattform, ticket 02; Alain 2026-10-21:
-- everyone signs up on their own, for Basalt only, no approval).
--
-- One row per signed-in user (Supabase Auth of the hub, magic link). The
-- TikTok handle is claimed at sign-up and proven with `bio_code` in the
-- account's bio. Until `verified_at` is set nothing is read or paid, and
-- several unverified people may claim the same handle; once verified, the
-- handle belongs to that creator alone (partial unique index), so nobody can
-- block a real owner by claiming his name first.
--
-- `estimate_accepted_at`: when the creator ticked that commission without a
-- link is an estimate. `has_link`: paid through his short link instead.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies). Applied via MCP migration `creator_accounts` (2026-10-21).

create table if not exists public.klar_creator_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users(id) on delete cascade,
  email                text not null,
  app_slug             text not null default 'basalt' references public.klar_creator_apps(slug) on update cascade,
  tiktok_handle        text not null,              -- lowercase, without @
  country              text not null check (country ~ '^[A-Z]{2}$'),
  platforms            text[] not null default '{tiktok}'
                       check (platforms <@ array['tiktok', 'instagram', 'youtube']::text[]),
  has_link             boolean not null default false,
  estimate_accepted_at timestamptz not null,
  bio_code             text not null,
  verified_at          timestamptz,
  created_at           timestamptz not null default now()
);

create unique index if not exists klar_creator_accounts_verified_handle_idx
  on public.klar_creator_accounts (tiktok_handle) where verified_at is not null;

alter table public.klar_creator_accounts enable row level security;
