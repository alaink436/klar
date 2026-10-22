-- creator_signup: a creator who signs up on getklar.org/dashboard reaches Alain like a website application, as
-- a notification event the digest mails out (Alain 2026-10-22: the first real sign-up showed up nowhere, neither in
-- Klar Control nor by mail).
alter table public.admin_notif_log drop constraint admin_notif_log_event_type_check;
alter table public.admin_notif_log add constraint admin_notif_log_event_type_check
  check (event_type = any (array['inquiry_new', 'setup_completed', 'creator_signup']));
