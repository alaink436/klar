-- 0005 — Close the RLS gap on klar_outreach_suppressions.
--
-- The other outreach tables (targets, runs, messages) have RLS enabled with no
-- policies (service-role-only; the app reads/writes via the service key). This
-- table was created out-of-band and shipped with RLS DISABLED + broad anon
-- grants, so the public anon key could read AND modify the do-not-contact list
-- (read STOP'd contacts, wipe suppressions to re-mail opted-out people, or inject
-- bogus rows). Bring it in line with the rest of the outreach schema.
--
-- Already applied to prod (project exiuwektrqxvycclqfdd) via apply_migration on
-- 2026-06-06; this file backfills it into version control so the schema is
-- reproducible. Idempotent.

ALTER TABLE public.klar_outreach_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.klar_outreach_suppressions FROM anon, authenticated;
