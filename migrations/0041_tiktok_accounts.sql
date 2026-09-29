-- klar_tiktok_accounts: the login data of every TikTok channel, shown on
-- /admin/vault/tiktok (Alain, 2026-09-29: "alle TikTok-Kanäle, Benutzername,
-- Passwort und verbundene E-Mail an einem Ort").
--
-- Username and e-mail are stored in clear so the page can list them at a
-- glance. The password is AES-256-GCM encrypted with the same VAULT_MASTER_KEY
-- as vault_secrets (lib/vault) and only decrypted on an explicit "anzeigen"
-- click in the 2FA-gated admin. Agents never see it: no proxy, no token path.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies), same posture as vault_secrets.
-- Applied to exiuwektrqxvycclqfdd via MCP migration `klar_tiktok_accounts` (2026-09-29).

create table if not exists public.klar_tiktok_accounts (
  id           uuid primary key default gen_random_uuid(),
  channel      text not null,                 -- display name, e.g. "Kelva"
  username     text not null,                 -- TikTok handle without @
  email        text,                          -- e-mail the account is bound to
  note         text,                          -- phone number, 2FA hint, whatever else helps
  pw_ciphertext text,                         -- null = no password stored
  pw_iv        text,
  pw_auth_tag  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists klar_tiktok_accounts_channel_idx
  on public.klar_tiktok_accounts (lower(channel));

alter table public.klar_tiktok_accounts enable row level security;
