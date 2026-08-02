-- Creator-Engine (Marketing #3): creators post prepared content for one Klar
-- app of their choice and are paid through the existing affiliate mechanics.
-- Recruited via dedicated TikTok channels in the make-money niche; the funnel
-- is  recruiting channel -> landing -> signup -> app choice -> asset pack ->
-- their own posts -> installs -> rev-share.
--
-- Concept + phases: AI-Brain `Projects/Marketing-3-Creator-Engine/PRD.md`.
--
-- Two tables:
--   klar_creators       one row per person in the program
--   klar_creator_posts  one row per published post (creator's OR our own)
--
-- klar_creator_posts is deliberately the general "posted content" table the
-- content dashboard has been missing: it carries an EXPLICIT app slug, which
-- replaces the two text heuristics that guess today (detectApp in
-- /admin/content, detectCollabApp in lib/collabStore). Our own studio posts
-- get source='studio' and creator_id null, creator posts get source='creator'.
--
-- Lives in the anime-vault Klar-Hub Supabase (exiuwektrqxvycclqfdd), next to
-- klar_outreach_targets / klar_collab_messages. RLS: service-role only, same
-- posture as its neighbours — the admin reads it with KLAR_INBOX_SERVICE_KEY.

-- ── Creators ────────────────────────────────────────────────────────────────

create table if not exists public.klar_creators (
  id                 uuid primary key default gen_random_uuid(),

  -- Identity on the platform they post from.
  handle             text not null,
  platform           text not null default 'tiktok'
                       check (platform in ('tiktok', 'instagram', 'youtube')),
  display_name       text,
  email              text,
  language           text not null default 'de',
  follower_estimate  integer,

  -- The app this creator promotes. One app per creator row; someone who wants
  -- to push two apps gets two rows (keeps attribution and payout unambiguous).
  app                text not null,

  -- Lifecycle. 'applied' = signed up but not yet usable, 'active' = has a
  -- tracking link and may post, 'paused' = self-paused or dormant,
  -- 'blocked' = kill-switch (policy violation, fake claims, spam).
  status             text not null default 'applied'
                       check (status in ('applied', 'active', 'paused', 'blocked')),

  -- Which recruiting channel produced this signup. This is the whole point of
  -- running several channels: without it we cannot tell which one works.
  -- Free text so a new channel needs no migration, e.g. 'tiktok:@sidehustle_de'.
  source             text,

  -- Bridge into the existing affiliate mechanics. `tracking_handle` is the
  -- influencer handle minted in the app's own Supabase (see lib/ensureAffiliate
  -- + /admin/affiliate-create); `tracking_url` is the /i/<handle> link the
  -- creator puts in their bio.
  tracking_handle    text,
  tracking_url       text,

  notes              text,

  applied_at         timestamptz not null default now(),
  activated_at       timestamptz,
  blocked_at         timestamptz,
  last_post_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- One row per (platform, handle, app): the same person may promote two apps,
-- but not twice the same one.
create unique index if not exists klar_creators_identity_uidx
  on public.klar_creators (platform, lower(handle), app);

-- Funnel + listing: newest applications first, filtered by status.
create index if not exists klar_creators_status_idx
  on public.klar_creators (status, applied_at desc);

-- Per-app and per-recruiting-channel breakdowns on the admin page.
create index if not exists klar_creators_app_idx    on public.klar_creators (app);
create index if not exists klar_creators_source_idx on public.klar_creators (source);

alter table public.klar_creators enable row level security;
-- Intentionally no policies => anon/authenticated see nothing; service-role
-- bypasses RLS. Identical lockdown to klar_outreach_targets.

-- ── Posts ───────────────────────────────────────────────────────────────────

create table if not exists public.klar_creator_posts (
  id            uuid primary key default gen_random_uuid(),

  -- null for our own studio posts; set for creator posts.
  creator_id    uuid references public.klar_creators (id) on delete set null,
  source        text not null default 'creator'
                  check (source in ('creator', 'studio')),

  -- EXPLICIT app slug — the reason this table exists. Never guessed.
  app           text not null,

  platform      text not null default 'tiktok',
  -- Blotato account id for studio posts, creator handle for creator posts.
  channel       text,
  -- Which asset variant was handed out, so we can tell which pack performs
  -- and prove each creator got a distinct render (TikTok hashes video files —
  -- identical uploads across a cohort get suppressed).
  asset_id      text,

  external_url  text,
  caption       text,

  -- Metrics, refreshed from the platform/Blotato analytics. Nullable: a post
  -- exists before it has numbers.
  views         integer,
  likes         integer,
  comments      integer,

  posted_at     timestamptz,
  metrics_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- Dashboard: recent posts, per app, per creator.
create index if not exists klar_creator_posts_posted_idx
  on public.klar_creator_posts (posted_at desc);
create index if not exists klar_creator_posts_app_idx
  on public.klar_creator_posts (app, posted_at desc);
create index if not exists klar_creator_posts_creator_idx
  on public.klar_creator_posts (creator_id, posted_at desc);

-- An importer re-running must not double-insert the same published post.
create unique index if not exists klar_creator_posts_external_uidx
  on public.klar_creator_posts (external_url)
  where external_url is not null;

alter table public.klar_creator_posts enable row level security;
-- Intentionally no policies => service-role only, as above.
