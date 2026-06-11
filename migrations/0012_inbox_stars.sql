-- Starred inbox conversations (admin-only). conv_id is the MailClient
-- conversation id: outreach target uuid, "inq-<uuid>" for inquiries, or the
-- affiliate user uuid for dashboard chats. service-role only (no policies),
-- same RLS pattern as klar_scrape_settings. Already applied to
-- exiuwektrqxvycclqfdd via MCP migration `klar_inbox_stars` (2026-06-11).
create table if not exists public.klar_inbox_stars (
  conv_id text primary key,
  starred_at timestamptz not null default now()
);

alter table public.klar_inbox_stars enable row level security;
-- no anon/auth policies -> service-role only.
