-- 0006 — Categories + store-only secrets for the API-key Vault.
--
-- Two changes to public.vault_secrets:
--   1. `category` (nullable text) — a free-text grouping ("KI / LLM",
--      "Datenbank", …) so the vault UI can group keys. NULL/empty is shown as
--      "Sonstiges".
--   2. `base_url` is now NULLABLE. A secret WITHOUT a base_url is "store-only":
--      it is kept encrypted and can be revealed by the admin, but is not usable
--      through the proxy (e.g. a Supabase service role key you just want to stash
--      and read back). Secrets WITH a base_url stay fully proxyable as before.
--
-- Already applied to prod (project exiuwektrqxvycclqfdd) via apply_migration on
-- 2026-06-06; this file backfills it into version control so the schema is
-- reproducible. Idempotent.

ALTER TABLE public.vault_secrets
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.vault_secrets
  ALTER COLUMN base_url DROP NOT NULL;
