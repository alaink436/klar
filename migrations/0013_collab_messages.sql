-- klar_collab_messages: append-only mail log for the public per-app collab
-- addresses (e.g. animevault@reply.getklar.org on the AnimeVault TikTok
-- channel). Creators/brands write to those addresses; the Brevo inbound-parse
-- webhook routes them here by RECIPIENT alias (no outreach target involved),
-- and the admin answers from the inbox via /admin/collab/reply.
--
-- A "thread" is the (app, contact_email) pair — no separate threads table, the
-- inbox groups on read like the outreach mail-client does.
--
-- Written by:
--   * the Brevo inbound-parse webhook   /api/inbound/brevo    (direction='in')
--   * the admin collab reply route      /admin/collab/reply   (direction='out')
--
-- Lives in the anime-vault Klar-Hub Supabase (exiuwektrqxvycclqfdd), next to
-- klar_outreach_messages. RLS: service-role only (no policies), same posture.

create table if not exists public.klar_collab_messages (
  id            uuid primary key default gen_random_uuid(),
  app           text not null,                -- app slug from the alias map (lib/collabStore)
  alias         text not null,                -- local part the mail was sent to, e.g. 'animevault'
  contact_email text not null,                -- the external party (thread key with app)
  contact_name  text,
  direction     text not null check (direction in ('in', 'out')),
  subject       text,
  body          text not null default '',
  provider      text,                          -- 'brevo-inbound' | 'brevo'
  external_id   text,                          -- Brevo MessageId (inbound), for dedupe
  spam_score    real,
  sent_at       timestamptz,                   -- the email's own date header, if known
  created_at    timestamptz not null default now()
);

-- Thread fetch: all messages of one (app, contact) pair, oldest first.
create index if not exists klar_collab_messages_thread_idx
  on public.klar_collab_messages (app, contact_email, created_at);

-- Inbox listing: newest activity first.
create index if not exists klar_collab_messages_created_idx
  on public.klar_collab_messages (created_at desc);

-- Webhook retries / double-deliveries must not double-insert.
create unique index if not exists klar_collab_messages_external_uidx
  on public.klar_collab_messages (external_id)
  where external_id is not null;

alter table public.klar_collab_messages enable row level security;
-- Intentionally no policies => anon/authenticated see nothing; service-role
-- bypasses RLS. Identical lockdown to klar_outreach_messages.
