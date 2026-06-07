-- 0008_affiliate_messages.sql
-- In-app affiliate <-> Alain chat. Backs lib/affiliateChatStore, the dashboard
-- /dashboard/chat panel, and the "affiliate-chat" conversation kind in the
-- admin inbox. Applied to anime-vault (exiuwektrqxvycclqfdd) as migration
-- klar_affiliate_messages_v1 on 2026-06-07.

create table if not exists public.klar_affiliate_messages (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null,
  direction text not null check (direction in ('in','out')),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists klar_affiliate_messages_thread_idx
  on public.klar_affiliate_messages (affiliate_user_id, created_at);

-- Service-role only (RLS on, no policy): the dashboard API scopes by session
-- user, the admin inbox reads/writes via the service-role key.
alter table public.klar_affiliate_messages enable row level security;

comment on table public.klar_affiliate_messages is 'In-app affiliate <-> Alain chat. direction in = from affiliate, out = from Alain. Service-role only (RLS no-policy).';
