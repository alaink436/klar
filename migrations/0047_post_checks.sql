-- klar_post_checks + strikes: does a creator's post count (spec Projects/Klar/
-- specs/creator-plattform, ticket 04; Alain 2026-10-21: without a link only our
-- slideshows count, own content only with a link; a post the check cannot place
-- goes on a review list, a post Alain rejects is a strike).
--
-- One row per creator post, written when the post is first read with its
-- images. `status`:
--   counts      the images are one of his versions (ORB feature match)
--   link        he is paid through his link, any Basalt post is exposure
--   no_mention  no "Basalt" in the caption, not about us
--   not_ours    mentions Basalt, images not ours, at most 1000 views
--   review      mentions Basalt, images not ours, over 1000 views (review list)
--   approved    Alain: counts
--   rejected    Alain: own content without a link or false promises (a strike)
--   suspended   posted while his 30-day pause ran
-- `images`: copies in the private bucket creator-posts, because TikTok's image
-- links expire after about two days and the review list needs them later.
--
-- Strikes on the account: 1 warning, 2 a 30-day pause, 3 closed. Rejected posts
-- never earn; allowed ones are paid out even after the account is closed.
--
-- Lives in the Klar-Hub Supabase (exiuwektrqxvycclqfdd). RLS: service-role
-- only (no policies). Applied via the Management API (2026-10-21).

create table if not exists public.klar_post_checks (
  post_id         text primary key references public.klar_posts(post_id) on delete cascade,
  creator_id      uuid not null references public.klar_creator_accounts(id) on delete cascade,
  caption         text not null default '',
  mentions_basalt boolean not null,
  variant_id      uuid references public.klar_format_variants(id) on delete set null,
  checked_slides  integer not null default 0,
  matched_slides  integer not null default 0,
  images          text[] not null default '{}',
  status          text not null check (status in
                  ('counts', 'link', 'no_mention', 'not_ours', 'review', 'approved', 'rejected', 'suspended')),
  reject_reason   text check (reject_reason in ('own_content', 'false_claims')),
  reviewed_at     timestamptz,
  checked_at      timestamptz not null default now()
);

create index if not exists klar_post_checks_review_idx on public.klar_post_checks (checked_at) where status = 'review';

alter table public.klar_post_checks enable row level security;

alter table public.klar_creator_accounts
  add column if not exists strikes         integer not null default 0,
  add column if not exists suspended_until timestamptz,
  add column if not exists closed_at       timestamptz;

insert into storage.buckets (id, name, public)
values ('creator-posts', 'creator-posts', false)
on conflict (id) do nothing;
