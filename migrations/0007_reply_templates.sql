-- 0007_reply_templates.sql
-- Editable inbox-composer reply templates (per language). Backs the
-- /admin/reply-templates editor + getReplyTemplates() in lib/replyTemplateStore.
-- Applied to anime-vault (exiuwektrqxvycclqfdd) as migration
-- `klar_reply_templates_v1` on 2026-06-07.
--
-- The initial 20 rows (5 languages x interesse/infos/rueckfrage/ablehnen) were
-- seeded from the hardcoded set in src/lib/replyTemplates.ts, which stays as the
-- runtime fallback when this table is empty/unreachable. Seed INSERT omitted
-- here (data, not schema); see the Supabase migration for the full payload.

create table if not exists public.klar_reply_templates (
  id uuid primary key default gen_random_uuid(),
  language text not null check (language in ('de','en','es','it','fr')),
  template_key text not null,
  label text not null,
  subject text not null default '',
  body text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  unique (language, template_key)
);

-- Service-role only: RLS on with no policy blocks anon/authenticated; the admin
-- reads/writes with KLAR_INBOX_SERVICE_KEY (service-role bypasses RLS).
alter table public.klar_reply_templates enable row level security;

comment on table public.klar_reply_templates is 'Editable inbox-composer reply templates, per language. Service-role only (RLS no-policy). Seeded 2026-06-07 from lib/replyTemplates.ts; {{name}}/{{handle}} substituted client-side.';
