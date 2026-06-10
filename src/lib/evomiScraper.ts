// SERVER ONLY. Evomi realtime-scraper client for per-handle enrichment.
//
// Given the decrypted Evomi routing (from vault.getForProxy("ef44b8c6-…")), this
// enriches ONE handle at a time and returns a platform-neutral NormalizedProfile
// (or null on any non-recoverable failure). It does NOT shape klar_outreach_targets
// rows (that is outreachNormalize.ts) but DOES carry the aggregator-link fields the
// email crawl needs.
//
// IG  : POST /realtime, mode:"request", x-ig-app-id header in `additional_headers`
//       (which MUST be a JSON object in the POST body — as a GET query Evomi 422s).
// TT  : GET  /realtime, mode:"auto" (anti-bot render) → HTML with the embedded
//       __UNIVERSAL_DATA_FOR_REHYDRATION__ rehydration JSON.
//
// Robustness mirrors klar-scraper: non-200, login-wall (HTML where JSON expected),
// parse-miss (JSON present but our path empty), case-duplicate TikTok keys (safe
// under JSON.parse), statsV2.followerCount STRING coercion via Number(). Enrich*
// never throws — it resolves to { profile:null, status, reason } so the wave keeps
// going and logs a per-handle reason.

import "server-only";

const EVOMI_REALTIME = "/realtime"; // appended to the vault base_url
const IG_APP_ID = process.env.IG_APP_ID || "936619743392459";
const IG_WEB_PROFILE =
  "https://www.instagram.com/api/v1/users/web_profile_info/?username=";

const TIMEOUT_MS = Number(process.env.EVOMI_TIMEOUT_MS ?? 30_000);
const MAX_RETRIES = Number(process.env.EVOMI_MAX_RETRIES ?? 2);
const BACKOFF_MS = Number(process.env.EVOMI_BACKOFF_MS ?? 800);

/** Decrypted Evomi routing, exactly what vault.getForProxy(id) returns. */
export interface EvomiCreds {
  baseUrl: string; // "https://scrape.evomi.com/api/v1/scraper"
  authHeader: string; // "api_key"
  authIn: "header" | "query"; // "query"
  key: string;
}

/** Platform-neutral enriched profile. Carries the aggregator-link fields the
 *  email crawl reads (externalUrl / bioLinks), plus the raw bio for the regex. */
export interface NormalizedProfile {
  platform: "instagram" | "tiktok";
  handle: string; // lowercased, no leading @
  displayName: string | null;
  biography: string; // "" when absent
  followers: number; // 0 when absent
  profileUrl: string;
  businessEmail: string | null; // IG only; TT always null
  publicEmail: string | null; // IG only; TT always null
  externalUrl: string | null; // IG external_url; TT null
  bioLinks: { url: string; title?: string | null }[]; // IG bio_links; TT []
}

export type EnrichReason =
  | "ok"
  | "non-200"
  | "login-wall"
  | "parse-miss"
  | "timeout"
  | "deadline"
  | "error";

export interface EnrichResult {
  profile: NormalizedProfile | null;
  /** http status of the Evomi call (not the upstream), or 0 on network error */
  status: number;
  /** short machine reason for logging */
  reason: EnrichReason;
}

function evomiUrl(creds: EvomiCreds): string {
  // base_url already includes /api/v1/scraper; auth_in="query" => ?api_key=KEY.
  const u = new URL(creds.baseUrl.replace(/\/$/, "") + EVOMI_REALTIME);
  if (creds.authIn === "query") u.searchParams.set(creds.authHeader, creds.key);
  return u.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryable(status: number): boolean {
  return (
    status === 0 ||
    status === 429 ||
    status === 522 ||
    status === 524 ||
    (status >= 500 && status <= 599)
  );
}

// One Evomi realtime call with timeout + retry. `init` is the per-mode fetch init.
// Returns { status, text } — text is the Evomi response body (IG: JSON string;
// TT: HTML). status 0 = network/timeout failure after all retries.
async function evomiFetch(
  url: string,
  init: RequestInit,
): Promise<{ status: number; text: string; timedOut: boolean }> {
  let lastStatus = 0;
  let timedOut = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
      clearTimeout(t);
      lastStatus = res.status;
      const text = await res.text();
      if (res.ok) return { status: res.status, text, timedOut: false };
      if (!retryable(res.status) || attempt === MAX_RETRIES) {
        return { status: res.status, text, timedOut: false };
      }
    } catch (e) {
      clearTimeout(t);
      timedOut = (e as Error)?.name === "AbortError";
      lastStatus = 0;
      if (attempt === MAX_RETRIES) return { status: 0, text: "", timedOut };
    }
    await sleep(BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  return { status: lastStatus, text: "", timedOut };
}

// ---- Instagram: POST realtime, mode=request, x-ig-app-id ----
interface IgWebProfile {
  user?: {
    username?: string;
    full_name?: string;
    biography?: string;
    edge_followed_by?: { count?: number };
    business_email?: string | null;
    public_email?: string | null;
    external_url?: string | null;
    bio_links?: { url?: string; title?: string }[];
  };
}

export async function enrichInstagram(
  handle: string,
  creds: EvomiCreds,
): Promise<EnrichResult> {
  const u = handle.replace(/^@/, "").trim().toLowerCase();
  if (!u) return { profile: null, status: 0, reason: "error" };
  const body = JSON.stringify({
    url: IG_WEB_PROFILE + encodeURIComponent(u),
    mode: "request",
    additional_headers: { "x-ig-app-id": IG_APP_ID },
  });
  const r = await evomiFetch(evomiUrl(creds), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (r.status !== 200) {
    return { profile: null, status: r.status, reason: r.timedOut ? "timeout" : "non-200" };
  }
  let parsed: { data?: IgWebProfile } | null = null;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    /* login wall returns HTML, not JSON */
  }
  const user = parsed?.data?.user;
  if (!user?.username) {
    return { profile: null, status: 200, reason: parsed ? "parse-miss" : "login-wall" };
  }
  return {
    status: 200,
    reason: "ok",
    profile: {
      platform: "instagram",
      handle: String(user.username).toLowerCase(),
      displayName: user.full_name ?? null,
      biography: user.biography ?? "",
      followers: Number(user.edge_followed_by?.count ?? 0) || 0,
      profileUrl: `https://www.instagram.com/${user.username}/`,
      businessEmail: user.business_email ?? null,
      publicEmail: user.public_email ?? null,
      externalUrl: user.external_url ?? null,
      bioLinks: (user.bio_links ?? [])
        .filter((b): b is { url: string; title?: string } => Boolean(b) && typeof b.url === "string")
        .map((b) => ({ url: b.url, title: b.title ?? null })),
    },
  };
}

// ---- TikTok: GET realtime, mode=auto, parse __UNIVERSAL_DATA_FOR_REHYDRATION__ ----
// We extract the JSON from the <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"> tag
// WITHOUT cheerio (no DOM dep in the route) via a tolerant regex, then JSON.parse.
function extractUniversalData(html: string): unknown | null {
  const m = html.match(
    /<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

interface TtUserDetail {
  __DEFAULT_SCOPE__?: {
    "webapp.user-detail"?: {
      userInfo?: {
        // `bioLink.link` is the website a creator sets on their profile (often a
        // linktree/aggregator or their own site) — the only crawlable email
        // source for TikTok, which exposes no business/public email field.
        user?: { uniqueId?: string; nickname?: string; signature?: string; bioLink?: { link?: string } };
        // followerCount is a NUMBER in `stats` but a STRING in `statsV2` (newer
        // layout). Number() coerces both.
        stats?: { followerCount?: number | string };
        statsV2?: { followerCount?: number | string };
      };
    };
  };
}

export async function enrichTiktok(
  handle: string,
  creds: EvomiCreds,
): Promise<EnrichResult> {
  const h = handle.replace(/^@/, "").trim().toLowerCase();
  if (!h) return { profile: null, status: 0, reason: "error" };
  const target = `https://www.tiktok.com/@${h}`;
  const u = new URL(evomiUrl(creds));
  u.searchParams.set("url", target);
  u.searchParams.set("mode", "auto");
  const r = await evomiFetch(u.toString(), { method: "GET" });
  if (r.status !== 200) {
    return { profile: null, status: r.status, reason: r.timedOut ? "timeout" : "non-200" };
  }
  // Login-wall / captcha page: HTML with no rehydration script.
  const data = extractUniversalData(r.text) as TtUserDetail | null;
  const info = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo ?? null;
  const user = info?.user;
  if (!user?.uniqueId) {
    return { profile: null, status: 200, reason: data ? "parse-miss" : "login-wall" };
  }
  // stats first (number), statsV2 fallback (string) — Number() handles both, and
  // an empty-object guard avoids NaN when neither stats block is present.
  const stats = info?.stats ?? info?.statsV2 ?? {};
  return {
    status: 200,
    reason: "ok",
    profile: {
      platform: "tiktok",
      handle: String(user.uniqueId).toLowerCase(),
      displayName: user.nickname ?? null,
      biography: user.signature ?? "",
      followers: Number(stats.followerCount ?? 0) || 0,
      profileUrl: target,
      businessEmail: null,
      publicEmail: null,
      // bioLink.link is the creator's website (aggregator or own site) — feeds
      // resolveContactEmail's aggregator + website crawl, same as IG external_url.
      externalUrl: (user.bioLink?.link ?? "").trim() || null,
      bioLinks: [],
    },
  };
}

/** Bounded-concurrency batch driver. Returns one EnrichResult per input handle,
 *  in input order. concurrency default 2 (IG bans on bursts; TT is softer). */
export async function enrichBatch(
  handles: string[],
  platform: "instagram" | "tiktok",
  creds: EvomiCreds,
  opts: { concurrency?: number; deadlineMs?: number } = {},
): Promise<EnrichResult[]> {
  const conc = Math.max(1, Math.min(opts.concurrency ?? 2, 5));
  const deadlineMs = opts.deadlineMs ?? 0;
  const enrichOne = platform === "instagram" ? enrichInstagram : enrichTiktok;
  const results = new Array<EnrichResult>(handles.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= handles.length) return;
      // Deadline guard: once the soft deadline passes, stop spending Evomi
      // credits. Drain remaining indices as skipped so none stay undefined
      // (the wave loop iterates every result).
      if (deadlineMs && Date.now() > deadlineMs) {
        results[i] = { profile: null, status: 0, reason: "deadline" };
        continue;
      }
      results[i] = await enrichOne(handles[i], creds);
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));
  return results;
}
