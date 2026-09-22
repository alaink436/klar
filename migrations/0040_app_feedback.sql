-- klar_app_feedback: what app users write to the support addresses of the apps
-- (suggestions, complaints, questions). The Gmail inboxes printed in the apps
-- and in the store listings forward to feedback+<app>@reply.getklar.org, the
-- Brevo inbound-parse webhook routes that alias here, and Klar Studios >
-- Feedback in Klar Control lists it.
--
-- One row per mail, no threads: answering happens from the mail client, the
-- dashboard only collects and ticks off.
--
-- Written by: /api/inbound/brevo. Read and ticked off by: /admin/feedback.
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies), same posture as klar_collab_messages.

create table if not exists public.klar_app_feedback (
  id            uuid primary key default gen_random_uuid(),
  app           text,                          -- app slug (lib/feedbackStore), null if not recognised
  inbox         text,                          -- the address the user wrote to, e.g. kelvasupport@gmail.com
  contact_email text not null,
  contact_name  text,
  subject       text,
  body          text not null default '',
  external_id   text,                          -- Brevo MessageId, for dedupe
  spam_score    real,
  sent_at       timestamptz,
  done_at       timestamptz,                   -- ticked off in the dashboard
  created_at    timestamptz not null default now()
);

create index if not exists klar_app_feedback_created_idx
  on public.klar_app_feedback (created_at desc);

create unique index if not exists klar_app_feedback_external_uidx
  on public.klar_app_feedback (external_id)
  where external_id is not null;

alter table public.klar_app_feedback enable row level security;
