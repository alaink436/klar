-- vault_secrets.auth_in: where the proxy injects the decrypted key.
--   'header' (default) -> set header `auth_header` to `auth_scheme + key`
--   'query'            -> append `?<auth_header>=<key>` to the upstream URL
-- For query-param APIs (e.g. Evomi Scraper API ?api_key=...), auth_header holds
-- the query-param NAME and auth_scheme is unused. Additive + backward-compatible:
-- every existing secret defaults to 'header' and behaves exactly as before.
-- Applied to exiuwektrqxvycclqfdd via MCP migration `vault_secrets_auth_in` (2026-06-09).
alter table public.vault_secrets
  add column if not exists auth_in text not null default 'header'
  check (auth_in in ('header','query'));
