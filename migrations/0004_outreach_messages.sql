-- klar_outreach_messages: append-only conversation thread per outreach target.
--
-- Replaces the single, overwritten `klar_outreach_targets.last_message` with a
-- real message log, so the /admin/replies mail-client can render the full
-- conversation AND count inbound replies ("3. Antwort von X").
--
-- Written by:
--   * the Brevo inbound-parse webhook   /api/inbound/brevo   (direction='in')
--   * the admin reply route             /admin/outreach/reply (direction='out')
--
-- Lives in the anime-vault Klar-Hub Supabase (exiuwektrqxvycclqfdd), next to
-- klar_outreach_targets. RLS: service-role only (no policies), same posture as
-- the targets table — only Klar's server reaches it with KLAR_INBOX_SERVICE_KEY.

create table if not exists public.klar_outreach_messages (
  id          uuid primary key default gen_random_uuid(),
  target_id   uuid not null references public.klar_outreach_targets(id) on delete cascade,
  direction   text not null check (direction in ('in', 'out')),
  subject     text,
  body        text not null default '',
  from_email  text,
  to_email    text,
  provider    text,        -- 'brevo-inbound' | 'brevo' | 'manual' | 'n8n'
  external_id text,         -- Brevo MessageId (inbound) / send id (outbound), for dedupe
  spam_score  real,
  sent_at     timestamptz, -- the email's own date header (SentAtDate), if known
  created_at  timestamptz not null default now()
);

-- Thread fetch: all messages for a target, oldest first.
create index if not exists klar_outreach_messages_target_idx
  on public.klar_outreach_messages (target_id, created_at);

-- Webhook retries / double-deliveries must not double-insert. Partial unique on
-- the provider message-id (null external_id rows, e.g. manual, are exempt).
create unique index if not exists klar_outreach_messages_external_uidx
  on public.klar_outreach_messages (external_id)
  where external_id is not null;

alter table public.klar_outreach_messages enable row level security;
-- Intentionally no policies => anon/authenticated see nothing; service-role
-- bypasses RLS. Identical lockdown to klar_outreach_targets.
