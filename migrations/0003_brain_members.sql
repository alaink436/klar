-- brain_members: who may read the AI-Brain at /brain, and how much of it.
--
-- Applied to the Klar Inbox Supabase (project exiuwektrqxvycclqfdd) — the
-- same project that backs auth.users for the affiliate dashboard, so a brain
-- member is just an auth.users row plus this scope row keyed by email.
--
-- clearance:
--   'brain' → access limited to the top-level folders listed in `folders`
--   'full'  → every non-secret folder (the app passes scope=null)
-- Secrets/Credentials are filtered out server-side in brainVault and at graph
-- build time regardless of clearance, so 'full' is never literally everything.
--
-- RLS is on with no policies: only the service-role key (the Klar server)
-- touches this table. anon/authenticated get nothing. Revoking sets
-- revoked_at; the /brain gate treats a non-null revoked_at as no access.

create table if not exists public.brain_members (
  email        text primary key,
  clearance    text not null default 'brain' check (clearance in ('brain','full')),
  folders      text[] not null default '{}',
  invited_by   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists brain_members_active_idx
  on public.brain_members (email) where revoked_at is null;

alter table public.brain_members enable row level security;

revoke all on public.brain_members from public, anon, authenticated;

comment on table public.brain_members is
  'AI-Brain reader allow-list keyed by email. Service-role only, RLS-locked. clearance brain=folder-scoped, full=all non-secret folders.';
