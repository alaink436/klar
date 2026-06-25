// SERVER ONLY. Native (on-platform) post counts for the /admin/content warm-up
// tracker.
//
// Why this exists: Blotato only knows posts IT published, and warm-up posts are
// posted MANUALLY (so the platform does not bot-flag a cold account). Blotato can
// therefore never report how many posts actually sit on a cold account, and its
// GET /v2/posts has no accountId either. The only source of truth is the public
// profile itself. We read it the same way the outreach wave does: an Evomi
// realtime scrape of the public TikTok/Instagram profile, then pull the native
// post count (TikTok stats.videoCount / IG edge_owner_to_timeline_media.count).
//
// Bounded + cached: each lookup spends Evomi credits and the number only creeps
// up slowly during warm-up, so successful reads cache 30 min (misses 5 min) and
// every fetch is hard-capped at LOOKUP_TIMEOUT_MS — a slow or blocked scrape must
// never hang /admin.

import "server-only";
import { getForProxy } from "./vault";
import { extractUniversalData } from "./evomiScraper";

const EVOMI_ID = "ef44b8c6-20f4-476a-8a18-2d8cd5f9b409";
const TTL_OK_MS = 30 * 60_000;
const TTL_MISS_MS = 5 * 60_000;
const LOOKUP_TIMEOUT_MS = 7_000;
const IG_APP_ID = process.env.IG_APP_ID || "936619743392459";
const IG_WEB_PROFILE = "https://www.instagram.com/api/v1/users/web_profile_info/?username=";

export interface NativeCount {
  posts: number | null; // native post/video count; null when the profile was not readable
  followers: number | null;
  ok: boolean; // true once we got a real profile read
  fetched_at: string;
}

interface EvomiRouting {
  baseUrl: string;
  authHeader: string;
  authIn: "header" | "query";
  key: string;
}

const miss = (): NativeCount => ({ posts: null, followers: null, ok: false, fetched_at: new Date().toISOString() });

// handle(lower) -> cached count. Module-level, same lifetime as the blotato key cache.
const _cache = new Map<string, { v: NativeCount; at: number }>();

function realtimeUrl(r: EvomiRouting): URL {
  // base_url already includes /api/v1/scraper; auth_in="query" => ?api_key=KEY.
  const u = new URL(r.baseUrl.replace(/\/$/, "") + "/realtime");
  if (r.authIn === "query") u.searchParams.set(r.authHeader, r.key);
  return u;
}

async function boundedFetch(url: string, init: RequestInit): Promise<{ ok: boolean; text: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
    const text = await res.text();
    return { ok: res.ok, text };
  } catch {
    return { ok: false, text: "" };
  } finally {
    clearTimeout(t);
  }
}

function toInt(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

interface TtStats {
  videoCount?: number | string;
  followerCount?: number | string;
}
interface TtData {
  __DEFAULT_SCOPE__?: { "webapp.user-detail"?: { userInfo?: { stats?: TtStats; statsV2?: TtStats } } };
}

async function lookupTiktok(handle: string, r: EvomiRouting): Promise<NativeCount> {
  const u = realtimeUrl(r);
  u.searchParams.set("url", `https://www.tiktok.com/@${handle}`);
  u.searchParams.set("mode", "auto");
  const res = await boundedFetch(u.toString(), { method: "GET" });
  if (!res.ok) return miss();
  const data = extractUniversalData(res.text) as TtData | null;
  const info = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
  if (!info) return miss();
  const stats = info.stats ?? info.statsV2 ?? {};
  const posts = toInt(stats.videoCount);
  if (posts === null) return miss();
  return { posts, followers: toInt(stats.followerCount), ok: true, fetched_at: new Date().toISOString() };
}

interface IgUser {
  username?: string;
  edge_owner_to_timeline_media?: { count?: number };
  edge_followed_by?: { count?: number };
}

async function lookupInstagram(handle: string, r: EvomiRouting): Promise<NativeCount> {
  const res = await boundedFetch(realtimeUrl(r).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: IG_WEB_PROFILE + encodeURIComponent(handle),
      mode: "request",
      additional_headers: { "x-ig-app-id": IG_APP_ID },
    }),
  });
  if (!res.ok) return miss();
  let user: IgUser | undefined;
  try {
    user = (JSON.parse(res.text) as { data?: { user?: IgUser } })?.data?.user;
  } catch {
    return miss(); // login wall returns HTML, not JSON
  }
  if (!user?.username) return miss();
  return {
    posts: toInt(user.edge_owner_to_timeline_media?.count),
    followers: toInt(user.edge_followed_by?.count),
    ok: true,
    fetched_at: new Date().toISOString(),
  };
}

async function lookupOne(platform: string, handle: string, r: EvomiRouting): Promise<NativeCount> {
  if (platform === "tiktok") return lookupTiktok(handle, r);
  if (platform === "instagram") return lookupInstagram(handle, r);
  return miss();
}

/** Native post counts for the given accounts, keyed by lowercased username.
 *  Cached per handle (30 min on success, 5 min on miss); a creds outage returns
 *  uncached misses so it retries next render. Each scrape is time-boxed so a slow
 *  or blocked profile never stalls the admin page. */
export async function getNativeCounts(
  accounts: { platform: string; username: string }[],
): Promise<Map<string, NativeCount>> {
  const out = new Map<string, NativeCount>();
  if (accounts.length === 0) return out;

  const now = Date.now();
  const stale: { platform: string; handle: string }[] = [];
  for (const a of accounts) {
    const handle = a.username.trim().toLowerCase();
    if (!handle) continue;
    const hit = _cache.get(handle);
    const ttl = hit?.v.ok ? TTL_OK_MS : TTL_MISS_MS;
    if (hit && now - hit.at < ttl) out.set(handle, hit.v);
    else stale.push({ platform: a.platform, handle });
  }
  if (stale.length === 0) return out;

  const routing = await getForProxy(EVOMI_ID);
  if (!routing) {
    // Vault/creds unavailable — return misses for the stale ones, do not cache.
    for (const s of stale) out.set(s.handle, miss());
    return out;
  }
  const creds: EvomiRouting = {
    baseUrl: routing.baseUrl,
    authHeader: routing.authHeader,
    authIn: routing.authIn,
    key: routing.key,
  };
  // Cold accounts are few; fetch in parallel, each independently time-boxed.
  await Promise.all(
    stale.map(async (s) => {
      const v = await lookupOne(s.platform, s.handle, creds);
      _cache.set(s.handle, { v, at: Date.now() });
      out.set(s.handle, v);
    }),
  );
  return out;
}
