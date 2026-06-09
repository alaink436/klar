# Klar Server-Only Scraping Libs — Blueprint (Evomi enrichment + Apify discovery)

Status: design. Target: in-app, n8n-free outreach wave. All modules are SERVER ONLY
(`import "server-only"`), live under `src/lib/`, and are consumed by the new wave route
+ Vercel cron (designed separately). This document specifies the four libs the task
names, with real TypeScript signatures and the load-bearing core code.

```
src/lib/
  evomiScraper.ts      # Evomi client: IG (request) + TikTok (auto/browser) per-handle enrichment
  apifyDiscovery.ts    # Apify actors: hashtags->IG handles, keywords->TT handles
  outreachEmail.ts     # email regex + aggregator bio-link crawl (ports klar-scraper/src/email.ts)
  outreachNormalize.ts # NormalizedProfile -> klar_outreach_targets row (IG + TT mappers)
```

Why split this way: enrichment, discovery, email, and row-shaping are independently
testable and independently swappable. Discovery is the only piece that talks to Apify;
enrichment is the only piece that talks to Evomi; normalize/email are pure (no network
except the aggregator crawl, which lives in `outreachEmail.ts`).

---

## 0. Canonical field mappings (extracted from the live n8n PRE-CUTOVER nodes)

These are the source of truth the libs must reproduce. Verified against
`ykuQ4ZnKHgL8a2ii-PRE-CUTOVER.json` nodes **IG Format Targets**, **TikTok Format
Targets**, **Crawl Bio-Links For Email**, **Build Job List**, **IG Collect Usernames**.

### Follower buckets -> `[follower_min, follower_max]` (Build Job List `BUCKET_RANGE`)

| bucket | min | max |
|--------|-----|-----|
| nano  | 1000   | 10000    |
| micro | 10000  | 50000    |
| mid   | 50000  | 500000   |
| macro | 500000 | 50000000 |

Wave range = `[min(buckets.min), max(buckets.max)]`; default `[10000, 500000]` when none.
Note this is NOT identical to `lib/sizeBuckets.ts` (nano starts at 1000 here vs 0 there) —
the wave filter must use the n8n ranges, while `sizeOf` stays the DB/UI filter.

### IG Format Targets — profile -> row

- Read fields on the (Apify-shaped) profile: `username`, `followersCount`, `biography`,
  `businessEmail`, `publicEmail`, `fullName`, `url`.
- Email precedence: `businessEmail || publicEmail || firstBioRegexMatch`. **Drop the row
  if no email.**
- Follower filter: `f < fmin || f > fmax` -> skip.
- Row: `handle=lower(username)`, `platform='instagram'`, `display_name=fullName||null`,
  `profile_url=url || https://www.instagram.com/<u>/`, `follower_estimate=f||null`,
  `niche=job.niche||null`, `language=job.language||'de'`, `for_apps=[job.app]`,
  `priority=3`, `notes='discovery=wave; bio=' + bio.slice(0,130)` (newlines stripped),
  `contact_email=email`, `audience_size=null`, `status='queued'`.
- Cap output: `.slice(0, count)`.

### TikTok Format Targets — profile -> row

- Author block: `a = post.authorMeta || post.author || {}`.
- `handle = lower(a.name || a.uniqueId || a.nickname)`; dedupe on handle.
- `f = Number(a.fans || a.followerCount || 0)`; same follower filter.
- `bio = a.signature || a.bio`; email is **bio-regex only** (no business/public field on TT).
  **Drop the row if no email.**
- Row: same shape, `platform='tiktok'`, `display_name=a.nickName||a.nickname||handle`,
  `profile_url=https://www.tiktok.com/@<handle>`. Cap `.slice(0, count)`.

### Email regex (n8n uses two; we keep both, in the right place)

- Bio match (IG + TT format nodes): `/[\w.+-]+@[\w-]+\.[\w.-]+/` (first match, lowercased+trimmed).
  This is identical to `klar-scraper/src/email.ts EMAIL_RE`.
- Aggregator-HTML scrape (Crawl node) uses a stricter pass: `mailto:` first, then
  `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g`, with block-domain /
  block-prefix / skip-extension filters. We port `klar-scraper/src/email.ts`
  (`pickEmailFromBio` + `crawlAggregator`) which already implements this behaviour and
  add the n8n-specific block lists the port is missing (see §3).

### Aggregator hostnames (identical in both klar-scraper email.ts and n8n Crawl node)

`linktr.ee, beacons.ai, allmylinks.com, bio.link, lnk.bio, mssg.me, stan.store,
komi.io, hoo.be, snipfeed.co, campsite.bio, shorby.com, withkoji.com, flow.page,
taplink.cc, milkshake.app` (16).

### Crawl trigger (Crawl Bio-Links For Email)

Only fires when: `!existingEmail (business||public)` AND bio has no email AND
`ext = externalUrl || external_url || bioLinks[0].url` matches an aggregator host. On a
hit, write the found email back into `businessEmail` so the format step picks it up
unchanged. Timeout 6000 ms, `redirect: follow`. **Same yield behaviour we must reproduce.**

---

## 1. `src/lib/evomiScraper.ts`

Server-only Evomi client. Given the decrypted Evomi key (caller pulls it via
`getForProxy("ef44b8c6-20f4-476a-8a18-2d8cd5f9b409")`), it enriches one handle at a time
and returns a `NormalizedProfile` (or `null` on any non-recoverable failure). It does NOT
shape `klar_outreach_targets` rows — that is `outreachNormalize.ts` — but it DOES carry
the aggregator-link fields the email crawl needs.

### Evomi modes & cost (per SHARED CONTEXT, confirmed live)

| call | HTTP | Evomi `mode` | cost | why |
|------|------|--------------|------|-----|
| IG `web_profile_info` JSON | POST body `{url,mode:"request",additional_headers:{x-ig-app-id}}` | `request` | ~2 credits | plain residential HTTP is enough for the IG JSON endpoint; no render |
| TikTok profile HTML | GET `?url=<profile>&mode=auto` | `auto` (anti-bot/render) | more credits | TikTok serves `__UNIVERSAL_DATA_FOR_REHYDRATION__` only through an anti-bot render |

`additional_headers` MUST be a JSON object in a POST body (as a GET query Evomi 422s
"should be a valid dictionary"). So IG is POST, TikTok is GET.

### Retry / timeout

- Per-request timeout: `EVOMI_TIMEOUT_MS` (default 30000). TikTok `auto` renders are slow;
  30 s gives headroom under the Vercel function limit. Implemented with `AbortController`
  (available in the Next.js Node runtime, unlike the n8n sandbox — so no `Promise.race`
  hack needed here).
- Retries: `EVOMI_MAX_RETRIES` (default 2) on network error / 429 / 5xx / 522/524, with
  exponential backoff `EVOMI_BACKOFF_MS * 2^attempt` (default base 800 ms) + jitter.
- A 404 / login-wall / parse-miss is NOT retried — it returns `null` (same "emit nothing,
  skip the handle" behaviour as `scrapeIgProfiles`/`scrapeTiktokProfiles`).
- Errors never throw out of `enrich*`; they resolve to `{ profile: null, error }` so the
  wave can keep going and log a per-handle reason.

### Types + signatures

```ts
// src/lib/evomiScraper.ts
import "server-only";

const EVOMI_REALTIME = "/realtime"; // appended to the vault base_url
const IG_APP_ID = process.env.IG_APP_ID || "936619743392459";
const IG_WEB_PROFILE = "https://www.instagram.com/api/v1/users/web_profile_info/?username=";

const TIMEOUT_MS  = Number(process.env.EVOMI_TIMEOUT_MS ?? 30_000);
const MAX_RETRIES = Number(process.env.EVOMI_MAX_RETRIES ?? 2);
const BACKOFF_MS  = Number(process.env.EVOMI_BACKOFF_MS ?? 800);

/** Decrypted Evomi routing, exactly what vault.getForProxy(id) returns. */
export interface EvomiCreds {
  baseUrl: string;   // "https://scrape.evomi.com/api/v1/scraper"
  authHeader: string; // "api_key"
  authIn: "header" | "query"; // "query"
  key: string;
}

/** Platform-neutral enriched profile. Carries the aggregator-link fields the
 *  email crawl reads (externalUrl / bioLinks), plus the raw bio for the regex. */
export interface NormalizedProfile {
  platform: "instagram" | "tiktok";
  handle: string;            // lowercased, no leading @
  displayName: string | null;
  biography: string;         // "" when absent
  followers: number;         // 0 when absent
  profileUrl: string;
  businessEmail: string | null; // IG only; TT always null
  publicEmail: string | null;   // IG only; TT always null
  externalUrl: string | null;   // IG external_url; TT null
  bioLinks: { url: string; title?: string | null }[]; // IG bio_links; TT []
}

export interface EnrichResult {
  profile: NormalizedProfile | null;
  /** http status of the Evomi call (not the upstream), or 0 on network error */
  status: number;
  /** short machine reason for logging: ok | non-200 | login-wall | parse-miss | timeout | error */
  reason: "ok" | "non-200" | "login-wall" | "parse-miss" | "timeout" | "error";
}

export async function enrichInstagram(handle: string, creds: EvomiCreds): Promise<EnrichResult>;
export async function enrichTiktok(handle: string, creds: EvomiCreds): Promise<EnrichResult>;

/** Bounded-concurrency batch driver. Returns one EnrichResult per input handle,
 *  in input order. concurrency default 2 (IG bans on bursts; TT is softer). */
export async function enrichBatch(
  handles: string[],
  platform: "instagram" | "tiktok",
  creds: EvomiCreds,
  opts?: { concurrency?: number },
): Promise<EnrichResult[]>;
```

### Core code

```ts
function evomiUrl(creds: EvomiCreds): string {
  // base_url already includes /api/v1/scraper; auth_in="query" => ?api_key=KEY.
  const u = new URL(creds.baseUrl.replace(/\/$/, "") + EVOMI_REALTIME);
  if (creds.authIn === "query") u.searchParams.set(creds.authHeader, creds.key);
  return u.toString();
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function retryable(status: number) {
  return status === 0 || status === 429 || status === 522 || status === 524 || (status >= 500 && status <= 599);
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

export async function enrichInstagram(handle: string, creds: EvomiCreds): Promise<EnrichResult> {
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
  try { parsed = JSON.parse(r.text); } catch { /* login wall returns HTML, not JSON */ }
  const user = parsed?.data?.user;
  if (!user?.username) return { profile: null, status: 200, reason: parsed ? "parse-miss" : "login-wall" };
  return {
    status: 200,
    reason: "ok",
    profile: {
      platform: "instagram",
      handle: String(user.username).toLowerCase(),
      displayName: user.full_name ?? null,
      biography: user.biography ?? "",
      followers: Number(user.edge_followed_by?.count ?? 0),
      profileUrl: `https://www.instagram.com/${user.username}/`,
      businessEmail: user.business_email ?? null,
      publicEmail: user.public_email ?? null,
      externalUrl: user.external_url ?? null,
      bioLinks: (user.bio_links ?? [])
        .filter((b) => b && typeof b.url === "string")
        .map((b) => ({ url: b.url as string, title: b.title ?? null })),
    },
  };
}

// ---- TikTok: GET realtime, mode=auto, parse __UNIVERSAL_DATA_FOR_REHYDRATION__ ----
// Robustness: TikTok's JSON has case-duplicate keys (lt/LT) — Node JSON.parse is
// fine (last key wins, the keys we read are unique). followerCount is a NUMBER in
// `stats` but a STRING in `statsV2`; Number() coerces both. We extract the JSON
// from the <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"> tag WITHOUT cheerio
// (no DOM dep in the route) via a tolerant regex, then JSON.parse.
function extractUniversalData(html: string): unknown | null {
  // id can carry extra attrs; capture the JSON between the script open/close.
  const m = html.match(
    /<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m?.[1]) return null;
  try { return JSON.parse(m[1].trim()); } catch { return null; }
}

interface TtUserDetail {
  __DEFAULT_SCOPE__?: {
    "webapp.user-detail"?: {
      userInfo?: {
        user?: { uniqueId?: string; nickname?: string; signature?: string };
        stats?: { followerCount?: number | string };
        statsV2?: { followerCount?: number | string };
      };
    };
  };
}

export async function enrichTiktok(handle: string, creds: EvomiCreds): Promise<EnrichResult> {
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
  if (!user?.uniqueId) return { profile: null, status: 200, reason: data ? "parse-miss" : "login-wall" };
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
      externalUrl: null, // TT detail JSON has no usable external link field for our purposes
      bioLinks: [],
    },
  };
}

export async function enrichBatch(
  handles: string[],
  platform: "instagram" | "tiktok",
  creds: EvomiCreds,
  opts: { concurrency?: number } = {},
): Promise<EnrichResult[]> {
  const conc = Math.max(1, Math.min(opts.concurrency ?? 2, 5));
  const enrichOne = platform === "instagram" ? enrichInstagram : enrichTiktok;
  const results = new Array<EnrichResult>(handles.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= handles.length) return;
      results[i] = await enrichOne(handles[i], creds);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  return results;
}
```

**Robustness notes baked in:** non-200 (incl. Evomi "Server Error"), login-wall (HTML
where JSON expected), parse-miss (JSON present but our path is empty), case-duplicate
TikTok keys (safe under `JSON.parse`), `statsV2.followerCount` string coercion, and all
fields optional with guards — mirrors the loose-by-design shapes in `klar-scraper`.

---

## 2. `src/lib/apifyDiscovery.ts` — discovery via Apify (handles only)

Discovery stays on the cheap Apify actors (IG hashtag search + TT keyword search are
captcha-walled via Evomi; per-handle enrichment is not). These functions return candidate
handle lists only; enrichment is Evomi's job.

### Apify key

`getForProxy("658f655b-11cd-4119-bea0-e6f4e6fc2c4a")` -> `{ baseUrl:
"https://api.apify.com/v2", authHeader:"authorization", authScheme:"Bearer ", authIn:
"header", key }`. The actor endpoints are `run-sync-get-dataset-items`, Bearer-authed.

### Signatures

```ts
// src/lib/apifyDiscovery.ts
import "server-only";

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_TIMEOUT_MS = Number(process.env.APIFY_TIMEOUT_MS ?? 180_000); // matches n8n's 180s

export interface ApifyCreds { key: string; baseUrl?: string }

/** IG: apify~instagram-hashtag-scraper. hashtags -> unique ownerUsername list.
 *  Mirrors n8n "Apify IG Hashtag" body { hashtags, resultsLimit } + "IG Collect
 *  Usernames" dedupe (ownerUsername || owner.username || username). */
export async function discoverInstagramHandles(
  hashtags: string[],
  resultsLimit: number,
  creds: ApifyCreds,
): Promise<{ handles: string[]; runId: string | null }>;

/** TikTok: apidojo~tiktok-scraper. keywords -> unique channel.username list with
 *  followers (so the wave can pre-filter before spending Evomi credits). */
export async function discoverTiktokHandles(
  keywords: string[],
  maxItems: number,
  creds: ApifyCreds,
): Promise<{ candidates: { handle: string; followers: number | null }[]; runId: string | null }>;
```

### Core code

```ts
async function runActor<T>(
  actor: string,
  body: unknown,
  creds: ApifyCreds,
): Promise<{ items: T[]; runId: string | null }> {
  const base = (creds.baseUrl ?? APIFY_BASE).replace(/\/$/, "");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), APIFY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/acts/${actor}/run-sync-get-dataset-items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.key}` },
        body: JSON.stringify(body),
        signal: ac.signal,
        cache: "no-store",
      },
    );
    clearTimeout(t);
    // Apify returns the run id in a header on run-sync endpoints.
    const runId = res.headers.get("x-apify-pagination-offset") ? null
      : (res.headers.get("x-apify-run-id") ?? null);
    if (!res.ok) return { items: [], runId };
    const items = (await res.json()) as T[];
    return { items: Array.isArray(items) ? items : [], runId };
  } catch {
    clearTimeout(t);
    return { items: [], runId: null };
  }
}

interface IgPost { ownerUsername?: string; owner?: { username?: string }; username?: string }

export async function discoverInstagramHandles(
  hashtags: string[],
  resultsLimit: number,
  creds: ApifyCreds,
): Promise<{ handles: string[]; runId: string | null }> {
  const { items, runId } = await runActor<IgPost>(
    "apify~instagram-hashtag-scraper",
    { hashtags, resultsLimit },
    creds,
  );
  const seen = new Set<string>();
  for (const post of items) {
    const u = post?.ownerUsername || post?.owner?.username || post?.username;
    if (u && typeof u === "string") seen.add(u.toLowerCase().trim());
  }
  return { handles: [...seen].filter(Boolean), runId };
}

interface TtItem { channel?: { username?: string; followers?: number | string } }

export async function discoverTiktokHandles(
  keywords: string[],
  maxItems: number,
  creds: ApifyCreds,
): Promise<{ candidates: { handle: string; followers: number | null }[]; runId: string | null }> {
  const { items, runId } = await runActor<TtItem>(
    "apidojo~tiktok-scraper",
    { keywords, maxItems },
    creds,
  );
  const seen = new Map<string, number | null>();
  for (const it of items) {
    const u = it?.channel?.username;
    if (!u || typeof u !== "string") continue;
    const h = u.toLowerCase().trim();
    if (seen.has(h)) continue;
    const f = it?.channel?.followers;
    seen.set(h, f == null ? null : Number(f) || null);
  }
  return {
    candidates: [...seen.entries()].slice(0, maxItems).map(([handle, followers]) => ({ handle, followers })),
    runId,
  };
}
```

**Discovery is intentionally cheap-and-dumb:** it surfaces handles; the follower filter +
email yield happen after Evomi enrichment, exactly like n8n's hashtag→profile fan-out.

---

## 3. `src/lib/outreachEmail.ts` — email regex + aggregator bio-link crawl

Ports `klar-scraper/src/email.ts` and adapts it: drop the `fetchViaProxy`/`agentForSession`
residential-proxy plumbing (the wave runs server-side, plain `fetch` is fine) and fold in
the **block lists the n8n Crawl node has that the klar-scraper port is missing** (the n8n
`BLOCK_DOMAIN_RE` adds `squarespace.com, cloudflare.com, amazonaws.com, googleapis.com,
jsdelivr.net, unpkg.com, cdn.*, placeholder.*` and treats the aggregator hosts themselves
as block-domains; the `BLOCK_PREFIX_RE` adds `admin, webmaster, hostmaster, root, nobody`
and aggregator-scoped `info@/support@`). Union of both lists = strictest, which is what we
want.

### Signatures

```ts
// src/lib/outreachEmail.ts
import "server-only";

export const AGGREGATORS: readonly string[]; // the 16 hosts, verbatim
export const EMAIL_RE: RegExp;               // /[\w.+-]+@[\w-]+\.[\w.-]+/ (bio match)

/** First plausible, non-blocked email in a bio string. Mirrors klar-scraper
 *  pickEmailFromBio: walk ALL matches so a leading placeholder doesn't hide a real one. */
export function pickEmailFromBio(bio: string | null | undefined): string | null;

/** True if url's host is one of the 16 aggregators (or a subdomain). */
export function isAggregatorUrl(url: string | null | undefined): boolean;

/** Fetch an aggregator page and scrape an email (mailto: first, then regex),
 *  applying the same block filters. 6s timeout (matches n8n). null on any failure. */
export async function crawlAggregator(url: string): Promise<string | null>;

/** The exact n8n Crawl-node trigger + write-back, generalised. Given an enriched
 *  profile, returns the resolved contact email or null. Order: business/public ->
 *  bio-regex -> aggregator crawl. Same yield as today. */
export async function resolveContactEmail(p: {
  biography: string;
  businessEmail: string | null;
  publicEmail: string | null;
  externalUrl: string | null;
  bioLinks: { url: string }[];
}): Promise<string | null>;
```

### Core code (block lists + resolver are the load-bearing parts)

```ts
export const AGGREGATORS = [
  "linktr.ee","beacons.ai","allmylinks.com","bio.link","lnk.bio","mssg.me",
  "stan.store","komi.io","hoo.be","snipfeed.co","campsite.bio","shorby.com",
  "withkoji.com","flow.page","taplink.cc","milkshake.app",
] as const;

export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// Union of klar-scraper BLOCK_DOMAINS and the n8n Crawl-node BLOCK_DOMAIN_RE.
const BLOCK_DOMAINS = [
  // klar-scraper
  "sentry.io","wixpress.com","example.com","domain.com","email.com","yourdomain.com",
  "cdn.com","googleusercontent.com","schema.org","w3.org","fontawesome.com",
  "cloudfront.net","gstatic.com",
  // n8n additions
  "squarespace.com","cloudflare.com","amazonaws.com","googleapis.com","jsdelivr.net",
  "unpkg.com","placeholder.com","example.org","example.net",
  // aggregator hosts are never the creator's contact address
  ...AGGREGATORS,
];
const BLOCK_PREFIXES = [
  "noreply","no-reply","donotreply","do-not-reply","postmaster","abuse","support@wix",
  "privacy","example","you@","name@","your@",
  // n8n additions
  "admin","webmaster","hostmaster","root","nobody","info@linktr","support@linktr",
  "info@beacons","support@beacons","info@bio.link","info@stan.store","info@komi.io",
];

function isBlockedEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const at = lower.indexOf("@");
  if (at < 0) return true;
  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  if (BLOCK_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return true;
  if (BLOCK_PREFIXES.some((p) => (p.includes("@") ? lower.startsWith(p) : local.startsWith(p)))) return true;
  if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|otf|map)$/i.test(domain)) return true;
  if (lower.length < 6 || lower.length > 120) return true; // n8n length guard
  return false;
}

export function pickEmailFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null;
  const re = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bio)) !== null) {
    const cand = m[0].replace(/[.,;:]+$/, "");
    if (!isBlockedEmail(cand)) return cand;
  }
  return null;
}

export function isAggregatorUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return AGGREGATORS.some((a) => host === a || host.endsWith("." + a));
  } catch { return false; }
}

export async function crawlAggregator(url: string): Promise<string | null> {
  if (!isAggregatorUrl(url)) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000); // n8n parity
  let html: string;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KlarBot/1.0; +https://getklar.org)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de,en;q=0.7",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    html = await res.text();
  } catch { clearTimeout(t); return null; }
  const mailto = html.match(/mailto:([\w.+-]+@[\w-]+\.[\w.-]+)/i);
  if (mailto?.[1] && !isBlockedEmail(mailto[1])) return mailto[1].toLowerCase();
  return pickEmailFromBio(html);
}

export async function resolveContactEmail(p: {
  biography: string;
  businessEmail: string | null;
  publicEmail: string | null;
  externalUrl: string | null;
  bioLinks: { url: string }[];
}): Promise<string | null> {
  const direct = (p.businessEmail || p.publicEmail || "").trim().toLowerCase();
  if (direct && !isBlockedEmail(direct)) return direct;
  const fromBio = pickEmailFromBio(p.biography);
  if (fromBio) return fromBio;
  // n8n trigger: only crawl when no direct + no bio email AND ext is an aggregator.
  const ext = p.externalUrl || p.bioLinks?.[0]?.url || "";
  if (ext && isAggregatorUrl(ext)) return crawlAggregator(ext);
  return null;
}
```

**Yield parity:** `resolveContactEmail` reproduces the exact n8n order — direct email,
then bio regex, then (only if both empty AND an aggregator link exists) a 6 s crawl whose
result is treated as the contact email. Same trigger, same timeout, same block filters,
so the wave yields the same set of emailable creators as today.

---

## 4. `src/lib/outreachNormalize.ts` — NormalizedProfile -> klar_outreach_targets row

Maps an Evomi `NormalizedProfile` (after email resolution) into the exact
`CreateTargetInput`-compatible shape the n8n format nodes produced, plus a **trial marker**
so isolated rows are identifiable + deletable (per the ISOLATION requirement). Applies the
follower-range filter and the no-email drop here, exactly like the format nodes.

### Signatures

```ts
// src/lib/outreachNormalize.ts
import "server-only";
import type { NormalizedProfile } from "./evomiScraper";
import { resolveContactEmail } from "./outreachEmail";

export interface WaveJob {
  app: string;
  niche: string | null;
  language: string;     // 'de' | 'en' | ...
  follower_min: number; // from BUCKET_RANGE
  follower_max: number;
  trial?: boolean;      // when true, stamp the trial marker into notes
}

/** Frozen target-row shape (subset of klar_outreach_targets that the wave writes).
 *  Matches IG/TikTok Format Targets output 1:1. */
export interface OutreachTargetRow {
  handle: string;
  platform: "instagram" | "tiktok";
  display_name: string | null;
  profile_url: string | null;
  follower_estimate: number | null;
  niche: string | null;
  language: string;
  for_apps: string[];
  priority: number;          // always 3
  contact_email: string;     // never empty (no-email rows are dropped)
  audience_size: string | null; // always null at scrape time
  notes: string | null;
  status: "queued";
}

/** Resolve email + apply follower filter + shape the row. Returns null when the
 *  profile fails the follower range OR has no resolvable email (= n8n drop). */
export async function normalizeToTarget(
  p: NormalizedProfile,
  job: WaveJob,
): Promise<OutreachTargetRow | null>;
```

### Core code

```ts
// Marker so trial rows inserted during the n8n-free wave are unambiguously
// identifiable + bulk-deletable: notes are prefixed, and the wave route also
// tags for_apps/source as agreed in the route design. Here we own the notes line.
const TRIAL_TAG = "[trial:evomi-wave]";

function buildNotes(bio: string, trial: boolean): string {
  const base = ("discovery=wave; bio=" + (bio || "").slice(0, 130)).replace(/\n/g, " ");
  return trial ? `${TRIAL_TAG} ${base}`.slice(0, 1000) : base.slice(0, 1000);
}

export async function normalizeToTarget(
  p: NormalizedProfile,
  job: WaveJob,
): Promise<OutreachTargetRow | null> {
  // 1) follower filter — identical to format nodes (f < fmin || f > fmax -> skip).
  const f = Number(p.followers || 0);
  if (f < job.follower_min || f > job.follower_max) return null;
  // 2) email resolution (direct -> bio -> aggregator crawl). Drop if none.
  const email = await resolveContactEmail(p);
  if (!email) return null;
  // 3) shape — byte-for-byte the n8n IG/TikTok Format Targets row.
  return {
    handle: p.handle.toLowerCase(),
    platform: p.platform,
    display_name: p.displayName ?? (p.platform === "tiktok" ? p.handle : null),
    profile_url: p.profileUrl ||
      (p.platform === "instagram"
        ? `https://www.instagram.com/${p.handle}/`
        : `https://www.tiktok.com/@${p.handle}`),
    follower_estimate: f || null,
    niche: job.niche ?? null,
    language: job.language || "de",
    for_apps: [job.app],
    priority: 3,
    contact_email: email,
    audience_size: null,
    notes: buildNotes(p.biography, Boolean(job.trial)),
    status: "queued",
  };
}
```

Note `display_name` for TT falls back to the handle (n8n: `a.nickName || a.nickname ||
handle`); for IG it stays `null` when `full_name` is absent (n8n: `p.fullName || null`).

The wave route (separate design) calls these in sequence per platform:
`discover* -> (pre-filter TT by followers) -> enrichBatch -> normalizeToTarget ->
dedupe against listOutreachTargets -> dryRun return OR createOutreachTarget`. DRY-RUN is
the default; insert only on an explicit commit flag; trial rows carry `[trial:evomi-wave]`
in notes for clean teardown.

---

## 5. Cost / mode / retry summary (the explicit answers the task asks for)

| concern | IG enrichment | TikTok enrichment | Apify discovery |
|---|---|---|---|
| transport | Evomi POST `/realtime` | Evomi GET `/realtime` | Apify `run-sync-get-dataset-items` POST |
| Evomi mode | `request` | `auto` | n/a |
| credit cost | cheap (~2 credits, plain residential) | higher (anti-bot render) | Apify $/dataset-item (IG ~$0.0023/item) + TT compute |
| timeout | 30 s (`EVOMI_TIMEOUT_MS`) | 30 s | 180 s (n8n parity) |
| retries | 2, backoff 800ms·2^n + jitter, only on 0/429/5xx/522/524 | same | none (single sync run; empty on failure) |
| not retried | 404 / login-wall / parse-miss -> `null` | login-wall/captcha/parse-miss -> `null` | non-200 -> `[]` |
| concurrency | `enrichBatch` default 2 (IG bans bursts) | default 2 | one call per platform |

**Chunkability (Vercel limit):** the wave caps handles per invocation at
`scrapeSettings.max_profiles_per_wave` (default 30, clamped 5..200). With concurrency 2 and
a 30 s per-call ceiling, a 30-handle TikTok batch is the worst case (~30·30s/2 ≈ 450s) — so
the route must clamp the TT batch well under the function limit (e.g. process ≤10 TT +
≤20 IG per invocation, or lower `max_profiles_per_wave`), and remaining handles roll to the
next cron tick. For the trial's small counts this fits one call.

## 6. Open items the route layer (not these libs) must handle
- Pull Evomi + Apify keys via `getForProxy(...)`; libs receive creds, never read the vault.
- DRY-RUN default + commit flag + trial marker propagation (`WaveJob.trial`).
- Dedupe via `listOutreachTargets` and insert via `createOutreachTarget`
  (upsert on_conflict=platform,handle) — libs only produce rows.
- Read `getScrapeSettings()` for `tiktok_backend` (selfhost vs apify — but enrichment is
  always Evomi here) and `max_profiles_per_wave`.
- Niche/hashtag pool + bucket-range resolution (port Build Job List `DEFAULT_NICHE_POOL` +
  `BUCKET_RANGE`); the libs take the resolved `WaveJob` already.
- Suppression check (`checkSuppressions`) before insert/mail.
- Auth: admin route gates on `klar_admin` + `klar_device`; cron route gates on `CRON_SECRET`.
```
