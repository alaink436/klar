// Blotato data for /admin/content — the posting-pipeline dashboard.
//
// Reads the connected social accounts (GET /v2/users/me/accounts) and the post
// history (GET /v2/posts, cursor-paginated) from the Blotato API
// (https://backend.blotato.com/v2, header auth `blotato-api-key`).
//
// The key comes from the Klar vault (provider "blotato"), decrypted server-side
// like apifyAccount.ts does — VAULT_MASTER_KEY lives only in Vercel. Cached 5min
// so admin refreshes don't hit Supabase + decrypt every render.
import "server-only";
import { listSecrets, revealSecret } from "./vault";

const BLOTATO_BASE = "https://backend.blotato.com/v2";
// Post-history cap: 8 pages × 250 = 2000 posts. Far above current volume; if it
// is ever hit, `truncated` flips true and the UI labels totals as "letzte 2000".
const MAX_POST_PAGES = 8;
const PAGE_LIMIT = 250;

export interface BlotatoAccount {
  id: string;
  platform: string;
  username: string;
  fullname: string;
}

export type BlotatoPostStateType = "scheduled" | "published" | "failed";

export interface BlotatoPost {
  id: string;
  postTime: string; // ISO 8601
  platform: string;
  text: string;
  mediaUrls: string[];
  state: { type: BlotatoPostStateType; postUrl?: string; errorMessage?: string };
}

export interface BlotatoPostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

// One row from GET /v2/analytics (top posts incl. latest metrics). `id` matches
// the post id from GET /v2/posts; postUrl is the live social-media URL.
export interface BlotatoAnalyticsItem {
  id: string;
  content: string;
  postUrl: string | null;
  platform: string;
  createdAt: string;
  metrics: BlotatoPostMetrics;
}

export interface BlotatoOverview {
  ok: boolean;
  reason: "live" | "no-key" | "http-error" | "exception";
  accounts: BlotatoAccount[];
  posts: BlotatoPost[]; // newest first, all states
  analytics: BlotatoAnalyticsItem[]; // top posts by views within the requested window
  truncated: boolean; // post history hit the page cap
  fetched_at: string;
}

function fallback(reason: BlotatoOverview["reason"]): BlotatoOverview {
  return { ok: false, reason, accounts: [], posts: [], analytics: [], truncated: false, fetched_at: new Date().toISOString() };
}

// Vault is the single source of truth for the key (entry provider "blotato");
// no env-var fallback on purpose — the vault entry exists since 2026-06-12.
let _keyCache: { key: string; at: number } | null = null;
async function getBlotatoKey(): Promise<string> {
  if (_keyCache && Date.now() - _keyCache.at < 300_000) return _keyCache.key;
  let key = "";
  try {
    const secrets = await listSecrets();
    const entry = secrets.find(
      (s) => !s.revoked_at && (s.provider.toLowerCase() === "blotato" || s.label.toLowerCase().includes("blotato")),
    );
    if (entry) key = (await revealSecret(entry.id)) ?? "";
  } catch {
    /* vault unreachable — overview falls back to "no-key" */
  }
  _keyCache = { key, at: Date.now() };
  return key;
}

function parsePost(raw: unknown): BlotatoPost | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const state = (r.state ?? {}) as Record<string, unknown>;
  const type = state.type;
  if (type !== "scheduled" && type !== "published" && type !== "failed") return null;
  return {
    id: String(r.id ?? ""),
    postTime: String(r.postTime ?? ""),
    platform: String(r.platform ?? "other"),
    text: String(r.text ?? ""),
    mediaUrls: Array.isArray(r.mediaUrls) ? r.mediaUrls.map(String) : [],
    state: {
      type,
      postUrl: typeof state.postUrl === "string" ? state.postUrl : undefined,
      errorMessage: typeof state.errorMessage === "string" ? state.errorMessage : undefined,
    },
  };
}

// Count metrics arrive as strings ("12453"); rate metrics as numbers. Views
// falls back to playsCount (TikTok uses plays for some formats).
function num(v: unknown): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function parseAnalyticsItem(raw: unknown): BlotatoAnalyticsItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const m = ((r.latestMetrics as Record<string, unknown> | undefined)?.metrics ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    content: String(r.content ?? ""),
    postUrl: typeof r.postUrl === "string" ? r.postUrl : null,
    platform: String(r.platform ?? "other"),
    createdAt: String(r.createdAt ?? ""),
    metrics: {
      views: num(m.viewsCount) || num(m.playsCount),
      likes: num(m.likesCount),
      comments: num(m.commentsCount) + num(m.repliesCount),
      shares: num(m.sharesCount),
    },
  };
}

// sinceIso bounds the analytics window (post-creation time; metrics themselves
// are lifetime values). Blotato defaults to 30 days, so "Gesamt" passes an
// explicit early date. Capped at 100 items by the API — top posts by views.
export async function getBlotatoOverview(sinceIso?: string): Promise<BlotatoOverview> {
  const key = await getBlotatoKey();
  if (!key) return fallback("no-key");
  const auth = { "blotato-api-key": key };
  try {
    // Accounts change rarely — 5-min revalidate. Posts + analytics drive the
    // dashboard numbers — 60s keeps them fresh without hammering the API.
    const analyticsQs = new URLSearchParams({ sortBy: "views_count", limit: "100" });
    analyticsQs.set("since", sinceIso ?? "2024-01-01T00:00:00.000Z");
    const [accountsRes, analyticsRes] = await Promise.all([
      fetch(`${BLOTATO_BASE}/users/me/accounts`, { headers: auth, next: { revalidate: 300 } }),
      // Best-effort: a failing analytics call must not kill the dashboard.
      fetch(`${BLOTATO_BASE}/analytics?${analyticsQs}`, { headers: auth, next: { revalidate: 60 } }).catch(() => null),
    ]);
    if (!accountsRes.ok) return fallback("http-error");
    let analytics: BlotatoAnalyticsItem[] = [];
    if (analyticsRes?.ok) {
      try {
        const json = (await analyticsRes.json()) as { items?: unknown[] };
        analytics = (json.items ?? []).map(parseAnalyticsItem).filter((x): x is BlotatoAnalyticsItem => x !== null);
      } catch {
        /* malformed analytics — dashboard renders without metrics */
      }
    }
    const accountsJson = (await accountsRes.json()) as { items?: unknown[] };
    const accounts: BlotatoAccount[] = (accountsJson.items ?? []).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const r = raw as Record<string, unknown>;
      return [{
        id: String(r.id ?? ""),
        platform: String(r.platform ?? "other"),
        username: String(r.username ?? ""),
        fullname: String(r.fullname ?? ""),
      }];
    });

    const posts: BlotatoPost[] = [];
    let cursor: string | null = null;
    let truncated = false;
    for (let page = 0; page < MAX_POST_PAGES; page++) {
      const qs = new URLSearchParams({ limit: String(PAGE_LIMIT) });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`${BLOTATO_BASE}/posts?${qs}`, { headers: auth, next: { revalidate: 60 } });
      if (!res.ok) {
        if (page === 0) return fallback("http-error");
        break; // keep what we have — partial history beats an error page
      }
      const json = (await res.json()) as { items?: unknown[]; cursor?: string };
      for (const raw of json.items ?? []) {
        const p = parsePost(raw);
        if (p) posts.push(p);
      }
      cursor = json.cursor ?? null;
      if (!cursor) break;
      if (page === MAX_POST_PAGES - 1) truncated = true;
    }
    posts.sort((a, b) => (a.postTime < b.postTime ? 1 : -1));

    return { ok: true, reason: "live", accounts, posts, analytics, truncated, fetched_at: new Date().toISOString() };
  } catch {
    return fallback("exception");
  }
}
