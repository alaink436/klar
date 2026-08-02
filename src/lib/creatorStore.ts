// SERVER ONLY. Creator-Engine (Marketing #3): people who post prepared content
// for one Klar app of their choice, paid through the existing affiliate
// mechanics. Recruited via dedicated TikTok channels in the make-money niche.
//
// Tables `klar_creators` + `klar_creator_posts` (Migration 0014) live in the
// anime-vault Klar-Hub Supabase (exiuwektrqxvycclqfdd), next to
// klar_outreach_targets / klar_collab_messages. RLS: service-role only, so
// every call here uses KLAR_INBOX_SERVICE_KEY.
//
// Everything is fail-soft to empty/zero: the admin page must still render
// before Migration 0014 has been applied (PostgREST answers 404 for an unknown
// table, which lands in the same `!res.ok` branch as any other failure).
//
// Concept + phases: AI-Brain `Projects/Marketing-3-Creator-Engine/PRD.md`.
import "server-only";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

function hdr(): HeadersInit {
  return {
    apikey: KLAR_INBOX_KEY,
    Authorization: `Bearer ${KLAR_INBOX_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** False when no service key is configured — the page then shows a setup hint
 *  instead of empty tables that look like "no creators yet". */
export function isCreatorEngineConfigured(): boolean {
  return Boolean(KLAR_INBOX_KEY);
}

// ── Types ───────────────────────────────────────────────────────────────────
// Live in lib/creatorTypes (no server-only) so the client components under
// /admin/creators can import the status list and labels. Re-exported here so
// server code has a single import site.

import type {
  Creator,
  CreatorPost,
  CreatorStatus,
  CreatorPlatform,
  PostSource,
  CreatorFunnel,
  CreatorBucket,
} from "./creatorTypes";

export type {
  Creator,
  CreatorPost,
  CreatorStatus,
  CreatorPlatform,
  PostSource,
  CreatorFunnel,
  CreatorBucket,
};
export {
  CREATOR_STATUSES,
  CREATOR_STATUS_LABEL,
  EMPTY_CREATOR_FUNNEL,
} from "./creatorTypes";

// ── Reads ───────────────────────────────────────────────────────────────────

export interface ListCreatorsFilter {
  status?: CreatorStatus | "all";
  app?: string | "all";
  source?: string | "all";
  limit?: number;
}

/** Creators, newest application first. Fail-soft to []. */
export async function listCreators(filter: ListCreatorsFilter = {}): Promise<Creator[]> {
  if (!KLAR_INBOX_KEY) return [];
  const p = new URLSearchParams();
  p.set("select", "*");
  p.set("order", "applied_at.desc");
  p.set("limit", String(filter.limit ?? 500));
  if (filter.status && filter.status !== "all") p.set("status", `eq.${filter.status}`);
  if (filter.app && filter.app !== "all") p.set("app", `eq.${filter.app}`);
  if (filter.source && filter.source !== "all") p.set("source", `eq.${filter.source}`);
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_creators?${p.toString()}`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as Creator[];
  } catch {
    return [];
  }
}

/** Published posts, newest first. `sinceDays` filters on posted_at when given
 *  (rows without posted_at are treated as not-yet-published and drop out). */
export async function listCreatorPosts(
  opts: { source?: PostSource | "all"; app?: string | "all"; sinceDays?: number; limit?: number } = {},
): Promise<CreatorPost[]> {
  if (!KLAR_INBOX_KEY) return [];
  const p = new URLSearchParams();
  p.set("select", "*");
  p.set("order", "posted_at.desc.nullslast");
  p.set("limit", String(opts.limit ?? 1000));
  if (opts.source && opts.source !== "all") p.set("source", `eq.${opts.source}`);
  if (opts.app && opts.app !== "all") p.set("app", `eq.${opts.app}`);
  if (opts.sinceDays != null) {
    const since = new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString();
    p.set("posted_at", `gte.${since}`);
  }
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_creator_posts?${p.toString()}`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as CreatorPost[];
  } catch {
    return [];
  }
}

// ── Aggregations ────────────────────────────────────────────────────────────
// Computed in TS from the fetched rows rather than via new RPCs — same approach
// the overview page takes, and it keeps Migration 0014 to plain tables.

export interface CreatorOverview {
  funnel: CreatorFunnel;
  /** Per chosen app. */
  byApp: CreatorBucket[];
  /** Per recruiting channel — which channel actually produces creators. */
  bySource: CreatorBucket[];
  creators: Creator[];
  recentPosts: CreatorPost[];
}

const num = (v: number | null | undefined): number => (typeof v === "number" ? v : 0);

/** One round-trip per table, then everything derived in memory. */
export async function getCreatorOverview(appLabel: (slug: string) => string): Promise<CreatorOverview> {
  const [creators, posts] = await Promise.all([
    listCreators({ limit: 1000 }),
    listCreatorPosts({ source: "creator", limit: 2000 }),
  ]);

  const cutoff = Date.now() - 7 * 86_400_000;
  const isRecent = (p: CreatorPost): boolean => {
    const t = p.posted_at ? Date.parse(p.posted_at) : NaN;
    return !isNaN(t) && t >= cutoff;
  };

  // creator_id -> posts, so "posting" means "has a post on record" rather than
  // trusting last_post_at, which an importer might not have written yet.
  const postsByCreator = new Map<string, CreatorPost[]>();
  for (const p of posts) {
    if (!p.creator_id) continue;
    const arr = postsByCreator.get(p.creator_id);
    if (arr) arr.push(p);
    else postsByCreator.set(p.creator_id, [p]);
  }

  const recent = posts.filter(isRecent);
  const active = creators.filter((c) => c.status === "active");
  const posting = active.filter((c) => (postsByCreator.get(c.id)?.length ?? 0) > 0);

  const funnel: CreatorFunnel = {
    applied: creators.length,
    active: active.length,
    posting: posting.length,
    paused: creators.filter((c) => c.status === "paused").length,
    blocked: creators.filter((c) => c.status === "blocked").length,
    posts7d: recent.length,
    views7d: recent.reduce((s, p) => s + num(p.views), 0),
    activationRatePct: active.length
      ? Math.round((posting.length / active.length) * 100)
      : null,
  };

  // Shared bucketing for both breakdowns: pick a key per creator, fold their
  // posts in, sort by size.
  const bucketBy = (
    keyOf: (c: Creator) => string | null,
    labelOf: (key: string) => string,
  ): CreatorBucket[] => {
    const map = new Map<string, CreatorBucket>();
    for (const c of creators) {
      const key = keyOf(c);
      if (!key) continue;
      let b = map.get(key);
      if (!b) {
        b = { key, label: labelOf(key), total: 0, active: 0, posting: 0, posts7d: 0, views7d: 0 };
        map.set(key, b);
      }
      b.total++;
      if (c.status === "active") b.active++;
      const own = postsByCreator.get(c.id) ?? [];
      if (own.length) b.posting++;
      for (const p of own) {
        if (!isRecent(p)) continue;
        b.posts7d++;
        b.views7d += num(p.views);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  };

  return {
    funnel,
    byApp: bucketBy((c) => c.app, appLabel),
    bySource: bucketBy((c) => c.source, (k) => k),
    creators,
    recentPosts: recent.slice(0, 25),
  };
}

/** Slim funnel for the overview page — same numbers, without the buckets and
 *  without shipping every creator row to a page that only draws three bars. */
export async function getCreatorFunnel(): Promise<CreatorFunnel> {
  const { funnel } = await getCreatorOverview((s) => s);
  return funnel;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface InsertCreatorInput {
  handle: string;
  app: string;
  platform?: CreatorPlatform;
  display_name?: string | null;
  email?: string | null;
  language?: string;
  follower_estimate?: number | null;
  source?: string | null;
  tracking_handle?: string | null;
  tracking_url?: string | null;
  notes?: string | null;
  status?: CreatorStatus;
}

/** Add a creator. Returns null on conflict (same handle already promotes this
 *  app) or any failure — callers surface that as a flash message. */
export async function insertCreator(input: InsertCreatorInput): Promise<Creator | null> {
  if (!KLAR_INBOX_KEY) return null;
  const handle = input.handle.trim().replace(/^@+/, "");
  if (!handle || !input.app) return null;
  const body = {
    handle,
    platform: input.platform ?? "tiktok",
    display_name: input.display_name ?? null,
    email: input.email?.trim().toLowerCase() || null,
    language: input.language ?? "de",
    follower_estimate: input.follower_estimate ?? null,
    app: input.app,
    status: input.status ?? "applied",
    source: input.source ?? null,
    tracking_handle: input.tracking_handle ?? null,
    tracking_url: input.tracking_url ?? null,
    notes: input.notes ?? null,
  };
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_creators`, {
      method: "POST",
      headers: { ...hdr(), Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Creator[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Status change (activate / pause / kill-switch). Stamps the matching
 *  timestamp so the funnel can tell when someone went live or was cut off. */
export async function setCreatorStatus(
  id: string,
  status: CreatorStatus,
): Promise<boolean> {
  if (!KLAR_INBOX_KEY || !id) return false;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === "active") patch.activated_at = now;
  if (status === "blocked") patch.blocked_at = now;
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_creators?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", headers: hdr(), body: JSON.stringify(patch) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Attach the minted affiliate link (from /admin/affiliate-create) to a
 *  creator and flip them to active in one step — that pairing is what makes a
 *  signup usable, so it should not be two separate admin actions. */
export async function setCreatorTracking(
  id: string,
  trackingHandle: string,
  trackingUrl: string,
): Promise<boolean> {
  if (!KLAR_INBOX_KEY || !id) return false;
  const now = new Date().toISOString();
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_creators?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: hdr(),
        body: JSON.stringify({
          tracking_handle: trackingHandle.trim().replace(/^@+/, "") || null,
          tracking_url: trackingUrl.trim() || null,
          status: "active",
          activated_at: now,
          updated_at: now,
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
