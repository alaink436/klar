-- Dashboard first (Alain 2026-10-22: "nach dem Mail-Link sofort das eigene Dashboard mit den Slideshows", "so wenig Friktion
-- wie möglich"): the account is created at the first login, before the creator names a TikTok account. Handle, country and
-- the estimate consent arrive with "connect your TikTok" inside the dashboard; verified accounts always have all three.
alter table public.klar_creator_accounts
  alter column tiktok_handle drop not null,
  alter column country drop not null,
  alter column estimate_accepted_at drop not null;
