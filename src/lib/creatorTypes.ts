// Client-safe types + constants for the Creator-Engine (Marketing #3).
//
// Deliberately WITHOUT `import "server-only"` and without any data access, so
// the client components under /admin/creators can import the status list and
// labels. `lib/creatorStore` (server-only) re-exports everything here, so
// server code keeps importing from a single place.
//
// This split exists because of the S79 regression: a "use client" module and a
// server module sharing a value-export across the boundary is exactly what
// broke /admin/inbox once already (Next handed the server page a reference
// proxy instead of the array, tsc + build both green). Same rule as
// lib/inboxFilters.ts — shared constants live in their own neutral module.

export type CreatorStatus = "applied" | "active" | "paused" | "blocked";
export type CreatorPlatform = "tiktok" | "instagram" | "youtube";
export type PostSource = "creator" | "studio";

export const CREATOR_STATUSES: CreatorStatus[] = ["applied", "active", "paused", "blocked"];

export const CREATOR_STATUS_LABEL: Record<CreatorStatus, string> = {
  applied: "Beworben",
  active: "Aktiv",
  paused: "Pausiert",
  blocked: "Gesperrt",
};

export interface Creator {
  id: string;
  handle: string;
  platform: CreatorPlatform;
  display_name: string | null;
  email: string | null;
  language: string;
  follower_estimate: number | null;
  app: string;
  status: CreatorStatus;
  /** Recruiting channel this signup came from, e.g. "tiktok:@sidehustle_de". */
  source: string | null;
  tracking_handle: string | null;
  tracking_url: string | null;
  notes: string | null;
  applied_at: string;
  activated_at: string | null;
  blocked_at: string | null;
  last_post_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorPost {
  id: string;
  creator_id: string | null;
  source: PostSource;
  app: string;
  platform: string;
  channel: string | null;
  asset_id: string | null;
  external_url: string | null;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  posted_at: string | null;
  metrics_at: string | null;
  created_at: string;
}

export interface CreatorFunnel {
  /** Everyone who ever signed up, any status. */
  applied: number;
  /** Has a tracking link and may post. */
  active: number;
  /** Active AND has at least one post on record. */
  posting: number;
  paused: number;
  blocked: number;
  /** Posts in the last 7 days, creator posts only. */
  posts7d: number;
  /** Views on those posts (null metrics count as 0). */
  views7d: number;
  /** Share of active creators that ever posted, 0-100, null when none active. */
  activationRatePct: number | null;
}

export interface CreatorBucket {
  key: string;
  label: string;
  total: number;
  active: number;
  posting: number;
  posts7d: number;
  views7d: number;
}

/** Zero-state funnel — used before Migration 0014 is applied and whenever the
 *  service key is missing, so pages render the same shape either way. */
export const EMPTY_CREATOR_FUNNEL: CreatorFunnel = {
  applied: 0,
  active: 0,
  posting: 0,
  paused: 0,
  blocked: 0,
  posts7d: 0,
  views7d: 0,
  activationRatePct: null,
};
