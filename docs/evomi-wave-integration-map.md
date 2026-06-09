# Evomi Wave — Klar Integration Map

Precise, code-grounded contract for the n8n-free outreach scraping wave implemented as a
Next.js route + Vercel cron in the Klar app. Every signature, field, and path below is
quoted from the real code (read 2026-06-09). File paths are absolute.

Repo root: `C:\Users\Alain Kessler\klar`

---

## 1. Vault — getting the decrypted Evomi + Apify keys server-side

File: `C:\Users\Alain Kessler\klar\src\lib\vault.ts` (header comment: **SERVER ONLY**, never import into a client component).

### Signature

```ts
export async function getForProxy(
  id: string,
  opts: { touch?: boolean } = {},
): Promise<{
  baseUrl: string;
  authHeader: string;            // e.g. "api_key" (Evomi) | "authorization" (Apify)
  authScheme: string;            // e.g. "Bearer " (Apify) | "" (Evomi query)
  authIn: "header" | "query";    // "query" for Evomi, "header" for Apify
  key: string;                   // decrypted plaintext API key
} | null>
```

### What it returns / behaviour
- Fetches the row from `vault_secrets` (Klar-Hub Supabase `exiuwektrqxvycclqfdd`, via `KLAR_INBOX_SUPABASE_URL` + `KLAR_INBOX_SERVICE_KEY`), AES-256-GCM decrypts `ciphertext/iv/auth_tag` using `VAULT_MASTER_KEY` (SHA-256 derived).
- Returns `null` when: vault not configured (`vaultReady()` false = missing service key or master key), row not found, `revoked_at` set, **`base_url` is null** (store-only secret), or decryption fails (wrong master key / tampered).
- By default it best-effort stamps `last_used_at` (fire-and-forget `touchSecretUsed`). **Pass `{ touch: false }`** if the wave does many lookups and you don't want each one to write a stamp — but for the trial, default touch is fine.
- `vaultReady()` is exported too: `return Boolean(SB_KEY() && MASTER())`.

### Can it be called from any server route?
**Yes** — it is a plain async function with no request/cookie dependency. It only needs the server env (`KLAR_INBOX_SERVICE_KEY`, `VAULT_MASTER_KEY`), which is present in any `runtime = "nodejs"` route/cron on Vercel. There is **no proxy hop and no admin/cron gate inside `getForProxy` itself** — the caller is responsible for its own auth gate. Import it directly:

```ts
import { getForProxy } from "@/lib/vault"; // or relative "../../../lib/vault"
```

### Evomi usage in the wave

```ts
const EVOMI_ID = "ef44b8c6-20f4-476a-8a18-2d8cd5f9b409";
const v = await getForProxy(EVOMI_ID);            // { baseUrl, authHeader:"api_key", authIn:"query", key }
if (!v) throw new Error("evomi key unavailable");
// v.baseUrl === "https://scrape.evomi.com/api/v1/scraper"
// Direct call, NO proxy: append ?api_key=KEY (authIn === "query", authHeader === "api_key")
```
- **IG enrichment** (POST, mode `"request"`, ~2 credits):
  `POST ${v.baseUrl}/realtime?api_key=${v.key}` with body
  `{ url: "https://www.instagram.com/api/v1/users/web_profile_info/?username=<U>", mode: "request", additional_headers: { "x-ig-app-id": "936619743392459" } }`.
  `additional_headers` MUST be a JSON object in the POST body (GET query → 422).
- **TikTok enrichment** (GET, mode `auto`, more credits, returns HTML):
  `GET ${v.baseUrl}/realtime?url=<https://www.tiktok.com/@HANDLE>&mode=auto&api_key=${v.key}`.

### Apify usage in the wave (discovery only — actors stay)

```ts
const APIFY_ID = "658f655b-11cd-4119-bea0-e6f4e6fc2c4a";
const a = await getForProxy(APIFY_ID);            // { baseUrl:"https://api.apify.com/v2", authHeader:"authorization", authScheme:"Bearer ", authIn:"header", key }
// Header auth: Authorization: `${a.authScheme}${a.key}`  ==> "Bearer <key>"
```
- TikTok discovery: `POST https://api.apify.com/v2/acts/apidojo~tiktok-scraper/run-sync-get-dataset-items` body `{ keywords:[...], maxItems }` → `items[].channel.username` (+followers).
- IG discovery: `POST https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items` body `{ hashtags:[...], resultsLimit }` → `posts[].ownerUsername`.
- Both with header `Authorization: Bearer <apify key>`.

**Note on `baseUrl` normalization:** `addSecret` stores `base_url` as `new URL(raw).origin + pathname.replace(/\/$/,"")` (trailing slash stripped). So Evomi `baseUrl` is exactly `https://scrape.evomi.com/api/v1/scraper` and Apify is `https://api.apify.com/v2`. Build child paths with a leading `/` (`${baseUrl}/realtime`, `${baseUrl}/acts/...`).

---

## 2. The EXACT `klar_outreach_targets` insert path

File: `C:\Users\Alain Kessler\klar\src\lib\outreachStore.ts` (SERVER ONLY; table `klar_outreach_targets` in `exiuwektrqxvycclqfdd`, RLS service-role only, uses `KLAR_INBOX_SERVICE_KEY`).

### IMPORTANT: there is NO upsert helper with `on_conflict=platform,handle` in this file.

The shared-context note says "upsert on_conflict=platform,handle", but the **actual code has no such helper**. The only insert function is `createOutreachTarget`, a plain POST with `Prefer: return=representation` (NOT merge-duplicates). It will 409 / error on a duplicate `(platform, handle)` if a UNIQUE constraint exists. So the wave must either:
- (a) **dedup before insert** via `listOutreachTargets` / a targeted select (recommended for the trial), or
- (b) add its own upsert call shaped like the other upserts in this file (see `upsertAppTemplate` / `addSuppression` which DO use `on_conflict=...` + `Prefer: resolution=merge-duplicates,return=representation`).

The canonical upsert shape to mirror (from `addSuppression`, lines ~761):
```ts
fetch(`${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets?on_conflict=platform,handle`, {
  method: "POST",
  headers: { ...hdr(), Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(row),
});
```
`hdr()` = `{ apikey, Authorization: Bearer <KLAR_INBOX_SERVICE_KEY>, Accept: application/json, Content-Type: application/json }`.

### `createOutreachTarget` — the real insert function

```ts
export interface CreateTargetInput {
  handle: string;
  platform: OutreachPlatform;          // "tiktok" | "instagram"
  display_name?: string | null;
  profile_url?: string | null;
  follower_estimate?: number | null;
  niche?: string | null;
  language?: string;                   // defaults "de"
  for_apps?: string[];                 // defaults []
  priority?: number;                   // defaults 3
  notes?: string | null;
}

export async function createOutreachTarget(input: CreateTargetInput): Promise<OutreachTarget>
```

### Exact row body POSTed (lines 249-260)

```ts
const body = {
  handle: input.handle.trim().replace(/^@/, "").toLowerCase(),  // normalized: strip @, lowercase
  platform: input.platform,
  display_name: input.display_name ?? null,
  profile_url: input.profile_url ?? null,
  follower_estimate: input.follower_estimate ?? null,
  niche: input.niche ?? null,
  language: input.language ?? "de",
  for_apps: input.for_apps ?? [],
  priority: input.priority ?? 3,
  notes: input.notes ?? null,
};
```
POST to `${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets` with `Prefer: return=representation`; throws `outreach insert <status>: <body>` on non-OK. Returns `rows[0]`.

**Gap vs. shared-context field list:** `createOutreachTarget` does **NOT** accept `contact_email` or `audience_size` (those are v3 n8n fields). `status` is not set by the body — it defaults to `'queued'` at the DB level. If the wave needs to write `contact_email` (from Evomi enrichment) and `audience_size` (size-bucket cohort), it must use a custom POST/upsert body that includes them (they exist as columns — see the `OutreachTarget` interface below), not `createOutreachTarget`.

### Dedup via `listOutreachTargets`

```ts
export interface ListFilter {
  platform?: OutreachPlatform | "all";
  status?: OutreachStatus | "all";
  app?: string | "all";
  query?: string;            // ILIKE over handle/display_name/niche/notes
  size?: SizeBucket | "all";
  limit?: number;            // clamped 1..500, default 200
}
export async function listOutreachTargets(f: ListFilter = {}): Promise<OutreachTarget[]>
```
- `f.size` is translated to PostgREST follower range filters: `follower_estimate=gte.<min>` and (if `max!==null`) `follower_estimate=lt.<max>` (lines 201-207).
- For precise per-handle dedup the wave should do a **targeted select** instead of pulling 200 rows. Mirror the existing pattern (`findTargetByEmail`, lines 942-959) — a direct PostgREST GET:
  ```ts
  // exact dedup check before insert
  GET ${KLAR_INBOX_URL}/rest/v1/klar_outreach_targets
      ?platform=eq.<platform>&handle=eq.<normalizedHandle>&select=id&limit=1
  headers: hdr()
  ```
  For a batch, use `handle=in.(...)` with `platform=eq.<p>` (see `checkSuppressions` lines 802-814 for the `in.(...)` quoting pattern: each value `"<value>"`, comma-joined).
- The wave should ALSO call `checkSuppressions({ handles, platform, emails })` (lines 781-828) before insert — it **fail-closes (throws)** on a missing key/lookup error so a do-not-contact handle can never slip through.

### The `OutreachTarget` interface fields the row touches (lines 29-73)

```ts
export interface OutreachTarget {
  id: string;
  handle: string;
  platform: OutreachPlatform;           // "tiktok" | "instagram"
  display_name: string | null;
  profile_url: string | null;
  follower_estimate: number | null;
  niche: string | null;
  language: string;
  for_apps: string[];
  priority: number;
  status: OutreachStatus;               // 'queued' | 'dm_sent' | 'replied' | 'declined' | 'converted' | 'dead'
  queued_at: string;
  // ... lifecycle timestamps (contacted_at, replied_at, ...) — set by later flow, not the wave
  notes: string | null;
  // v3 n8n-fields (Migration klar_outreach_targets_v3_n8n_fields):
  contact_email: string | null;
  audience_size: string | null;         // "A" | "B" | "C" cohort label
  mail_status: string | null;           // null until mailer claims it
  // ...
}
export type OutreachStatus = "queued" | "dm_sent" | "replied" | "declined" | "converted" | "dead";
export type OutreachPlatform = "tiktok" | "instagram";
```

**Fields the wave writes per target row:** `handle` (normalized), `platform`, `display_name`, `profile_url`, `follower_estimate`, `niche`, `language`, `for_apps[]`, `priority`, `contact_email` (from Evomi bio email), `audience_size` (size cohort), `notes` (← put the TRIAL marker here, see §7), `status` left to default `'queued'`. To carry `contact_email`/`audience_size` you need a custom body (createOutreachTarget can't).

### Run audit row — `createOutreachRun`

```ts
export interface CreateRunInput {
  apps: string[];
  platforms: string[];
  size_buckets?: string[];      // default ["micro","mid"]
  language?: OutreachLang;      // default "de"
  count_per_app: number;
  niche?: string | null;
  mail_subject?: string | null;
  mail_body?: string | null;
  cost_estimate_usd?: number | null;
}
export async function createOutreachRun(input: CreateRunInput): Promise<OutreachRun>
```
POSTs to `klar_outreach_runs` with `created_by:"admin"`, `status:"queued"`. The wave should create one run row for audit/cost tracking (and, for the trial, can mark the run with a trial marker in `niche` or via a dedicated field). Note `OutreachRun` has `targets_added`, `cost_actual_usd`, `apify_run_ids`, `started_at`, `finished_at`, `errors` — the wave is expected to PATCH these as it progresses (no helper exists yet; write a small `updateOutreachRun(id, patch)` mirroring the other PATCH helpers).

---

## 3. Size-bucket mechanics

File: `C:\Users\Alain Kessler\klar\src\lib\sizeBuckets.ts` (client-safe, pure data + pure fn; re-exported from `outreachStore.ts` as `SIZE_BUCKETS`, `sizeOf`, `SizeBucket`).

### Signatures + data

```ts
export type SizeBucket = "nano" | "micro" | "mid" | "macro";

// [min inclusive, max exclusive); null max = no upper bound
export const SIZE_BUCKETS: {
  value: SizeBucket; label: string; range: string; min: number; max: number | null;
}[] = [
  { value: "nano",  label: "Nano",  range: "<10k",   min: 0,       max: 10_000 },
  { value: "micro", label: "Micro", range: "10–50k", min: 10_000,  max: 50_000 },
  { value: "mid",   label: "Mid",   range: "50–500k",min: 50_000,  max: 500_000 },
  { value: "macro", label: "Macro", range: "500k+",  min: 500_000, max: null },
];

export function sizeOf(followers: number | null | undefined): SizeBucket | null;
// null/0/unknown -> null; else first bucket where followers>=min && (max===null||followers<max)
```

### Deriving follower_min/max per selected bucket
For a chosen `SizeBucket` value, look it up in `SIZE_BUCKETS` (`SIZE_BUCKETS.find(b => b.value === value)`) → `b.min` (inclusive) and `b.max` (exclusive, null = unbounded). For a **set** of selected buckets, follower_min = `min(b.min)` and follower_max = max of `b.max` (if any selected bucket has `max===null`, the combined max is unbounded). The store already encodes the PostgREST form: `follower_estimate=gte.<min>` + `follower_estimate=lt.<max>` (outreachStore lines 203-205).

### How the wave maps the n8n follower filter to buckets
The wave does the opposite direction of the filter: after **Evomi enrichment** yields a real `followerCount`, call `sizeOf(followerCount)` to get the candidate's bucket, then **keep the candidate only if `sizeOf(followers)` is in the wave's selected `size_buckets[]`**. This replaces n8n's "follower filter" node: instead of a range comparison in n8n, the in-app wave runs `selectedBuckets.includes(sizeOf(followers))`. Candidates with `null` follower count (sizeOf → null) are dropped (no bucket match) or flagged.

---

## 4. Scrape settings — read + honor `max_profiles_per_wave`

File: `C:\Users\Alain Kessler\klar\src\lib\scrapeSettings.ts` (SERVER ONLY via `import "server-only"`; singleton row `id=true` in `klar_scrape_settings`, `KLAR_INBOX_SERVICE_KEY`).

### Shape

```ts
export type ScrapeBackend = "apify" | "selfhost";
export type ProxyProvider = "iproyal" | "dataimpulse" | "none";

export interface ScrapeSettings {
  tiktok_backend: ScrapeBackend;       // "apify" | "selfhost"
  instagram_backend: ScrapeBackend;    // ALWAYS coerced to "apify" (IG residential blocked)
  max_profiles_per_wave: number;       // hard cap, clamped 5..200
  selfhost_enabled: boolean;
  proxy_provider: ProxyProvider;
  updated_at: string | null;
  updated_by: string | null;
}

export const DEFAULT_SCRAPE_SETTINGS: ScrapeSettings = {
  tiktok_backend: "apify", instagram_backend: "apify",
  max_profiles_per_wave: 30, selfhost_enabled: false,
  proxy_provider: "none", updated_at: null, updated_by: null,
};

export async function getScrapeSettings(): Promise<ScrapeSettings>;   // fail-soft to defaults
export function clampMaxProfiles(n: unknown): number;                 // Math.min(200, Math.max(5, round(n)))
export async function upsertScrapeSettings(patch: ScrapeSettingsPatch): Promise<ScrapeSettings>;
```
- `getScrapeSettings()` fetches `?id=eq.true&select=*&limit=1`, runs `coerce()` (forces `instagram_backend:"apify"`, clamps the cap, validates proxy provider), and **fail-softs to `DEFAULT_SCRAPE_SETTINGS`** if the key/table is missing or the fetch fails. So it never throws — safe to call at the top of the wave.

### How the wave reads/honors `max_profiles_per_wave`
1. At wave start: `const s = await getScrapeSettings();`
2. **Backend selection:** TikTok discovery uses `s.tiktok_backend` (only `"apify"` is implemented per the fixed architecture — `"selfhost"` is reserved/unproven and out of scope for the trial). IG discovery always uses Apify (`s.instagram_backend` is always `"apify"`).
3. **Cap the per-wave profile count:** clamp the effective enrichment count to `s.max_profiles_per_wave`. Concretely, after discovery produces candidate handles, enrich at most `s.max_profiles_per_wave` of them (and also cap against the wave's own `count_per_app`). The effective cap is `Math.min(count_per_app * platforms.length, s.max_profiles_per_wave)` (or apply per-platform as appropriate). This bounds Evomi credit spend AND keeps the invocation inside the Vercel function-duration limit (see §6 chunking).

---

## 5. Wave INPUT contract (mirror of `start/route.ts`)

File: `C:\Users\Alain Kessler\klar\src\app\admin\outreach\start\route.ts` (POST, `runtime="nodejs"`, `dynamic="force-dynamic"`). It reads a `FormData` and validates. Mirror these exact rules in the new wave endpoint (whether it takes JSON or form):

| Field | Source | Validation (exact) |
|---|---|---|
| `apps` | `form.getAll("apps")` | trim+lowercase; keep only slugs in `KLAR_APPS` with `status === "LIVE"`; dedupe; **≥1 required** else "Mindestens eine App auswählen". |
| `platforms` | `form.getAll("platforms")` | keep only `"tiktok"` or `"instagram"`; dedupe; **≥1 required**. |
| `size_buckets` | `form.getAll("size_buckets")` | `ALLOWED_BUCKETS = {nano,micro,mid,macro}`; dedupe; **≥1 required**. |
| `languages` | `form.getAll("languages")` | `ALLOWED_LANGS = {de,en,es,it,fr}`; default `["de"]` if none; **>1 → reject** ("Nur eine Region pro Welle"). |
| `count_per_app` | `form.get("count_per_app")` | `Number`; must be finite **integer**, `COUNT_MIN=1 .. COUNT_MAX=500`. |
| `niche` | `form.get("niche")` | trim, slice to `NICHE_MAX=80`, `null` if empty. |
| `mail_subject` | `form.get("mail_subject")` | trim, slice `SUBJECT_MAX=200`; **≥3 chars** required. |
| `mail_body` | `form.get("mail_body")` | trim, slice `BODY_MAX=10000`; **≥20 chars** required. |
| `cost_confirmed` | `form.get("cost_confirmed")` | must equal `"1"` when `totalEstimateUsd >= COST_CONFIRM_USD (2.00)`, else reject. |

- Apps whitelist source: `import { KLAR_APPS } from "@/lib/klarApps"` — `KLAR_APPS: KlarAppMeta[]`, each `{ slug, name, icon, status, affiliatePathPrefix }`; LIVE slugs today: `trubel, myloo, wavelength, yarn-stash, kelva, moto` (promillio is `BETA`).
- **Cross-product:** the route builds `combos = apps × languages` and creates one `createOutreachRun` row per combo (single-combo path keeps one row + one webhook). The new wave should preserve the **one run-row per (app, language)** model.
- **Cost guard:** `igCostPerWave(count, smallBucket)` + `ttCostPerWave(count)`; `smallBucketOnly = size_buckets.every(b => b==="nano"||b==="micro")`; per-app estimate × `apps×languages` combos; if `>= COST_CONFIRM_USD (2.00)` require `cost_confirmed==="1"`. For the Evomi wave the cost model changes (Apify discovery + Evomi credits) but the **confirm-threshold + fail-closed pattern should be reused**.
- The existing route fires an n8n webhook (`KLAR_OUTREACH_WEBHOOK_URL`, default `https://alaink365.app.n8n.cloud/webhook/klar-outreach-wave`). The Evomi wave **eliminates this** — instead of `fireWebhook`, the new code either runs the wave inline (small trial count) or lets the cron pick up the queued run row.

---

## 6. Auth + cron patterns to reuse

### Admin-gated route pattern (for an admin-triggered wave, e.g. POST `/admin/outreach/evomi-wave`)
Mirror `scrape-settings/route.ts` (the **full** gate — stronger than `start/route.ts` which only checks `klar_admin`):

```ts
import { readCookie, ctEqual } from "../../_shared";
import { verifyDeviceCookie } from "../../../../lib/deviceCookie";

const KEY = process.env.KLAR_ADMIN_KEY ?? "";
const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
if (!KEY || !DEV) return back(req, "Server misconfigured");
const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);  // HMAC device cookie
if (!device) return NextResponse.redirect(new URL("/admin/login", req.url), 303);
if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {                            // constant-time session check
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
```
Helpers (`C:\Users\Alain Kessler\klar\src\app\admin\_shared.ts`):
- `ctEqual(a, b): boolean` — constant-time string compare.
- `readCookie(req: Request, name): string` — parse a cookie off the request header.
- `verifyDeviceCookie(raw, secret): Promise<DevicePayload | null>` (`C:\Users\Alain Kessler\klar\src\lib\deviceCookie.ts`) — HMAC-SHA256 verify + age check (≤365d).

### Cron-gated route pattern (RECOMMENDED for the Evomi wave — long-running, isolated)
Mirror `C:\Users\Alain Kessler\klar\src\app\api\cron\outreach-mail\route.ts` / `app-metrics\route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!SECRET || auth !== `Bearer ${SECRET}`) {                 // fail-closed: no secret => 401, nothing runs
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // ... wave body
  return NextResponse.json({ ok: true, report });
}
```
Vercel attaches `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` env is set. Both existing crons return JSON (not redirects). Use this gate for the cron-driven wave; use the admin gate for a manual "start trial wave" button.

### Where Vercel cron is configured
`C:\Users\Alain Kessler\klar\vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/outreach-mail", "schedule": "0 9 * * *" },
    { "path": "/api/cron/app-metrics",   "schedule": "0 3 * * *" }
  ]
}
```
Add a third entry for the Evomi wave, e.g. `{ "path": "/api/cron/evomi-wave", "schedule": "..." }`.

### maxDuration
- **No `maxDuration` is set anywhere** in the repo — not in `vercel.json`, not as a route export, not in `next.config`. The existing crons (`outreach-mail`, `app-metrics`) run on the **Vercel plan default function duration** (Hobby 10s / Pro 60s default; max 300s Pro, configurable). 
- The Evomi wave does many sequential HTTP round-trips (Apify discovery + per-handle Evomi enrichment, TikTok `mode=auto` is slow). It **must** set `export const maxDuration = 300;` (or the highest the plan allows) in the route file, AND be **chunkable**: process a bounded batch per invocation (cap by `min(count_per_app, max_profiles_per_wave)` per §4). For the trial's small count, one invocation fits; for larger waves, persist progress on the `klar_outreach_runs` row (`status`, `targets_added`) and resume on the next cron tick.

---

## 7. Isolation / trial markers (architecture requirement)

- **DRY-RUN by default:** the wave returns the would-be target rows as JSON for inspection and inserts NOTHING unless an explicit commit flag is set (e.g. `?commit=1` on the route, or a `commit:true` field). Mirror the `outreach-mail` cron's `dryRun` concept (`runOutreachMailer({ dryRun: false })`) — default the wave to dry-run.
- **Trial marker on inserted rows:** since `createOutreachTarget` exposes `notes`, write a clear sentinel into `notes` (e.g. `notes: "[evomi-trial 2026-06-09]"`) so trial rows are identifiable and deletable via `listOutreachTargets({ query: "evomi-trial" })` (the ILIKE filter covers `notes`) and removable with `deleteOutreachTarget(id)`. Also mark the run row (`niche` or a dedicated field) so the audit row is identifiable.
- Do NOT fire the n8n webhook; do NOT write to live `for_apps` cost/metric aggregates beyond what a normal target needs.

---

## 8. End-to-end call sequence for the wave

1. **Gate** (CRON_SECRET for cron, or admin+device for manual) — §6.
2. `const s = await getScrapeSettings();` — backends + `max_profiles_per_wave` (§4).
3. Read/validate input (apps LIVE-whitelist, platforms, size_buckets, language, count, niche, mail) — §5.
4. `const apify = await getForProxy("658f655b-11cd-4119-bea0-e6f4e6fc2c4a");` — discovery (§1).
5. Apify discovery per platform → candidate handles (TikTok keywords actor, IG hashtag actor), capped by `min(count_per_app, max_profiles_per_wave)`.
6. `checkSuppressions({ handles, platform })` (fail-closed) + dedup select against `klar_outreach_targets` (§2).
7. `const evomi = await getForProxy("ef44b8c6-20f4-476a-8a18-2d8cd5f9b409");` — per-handle enrichment (§1): IG POST `mode:"request"`, TikTok GET `mode=auto`. Parse bio/followers/email/links (reuse `klar-scraper` normalize/email logic).
8. Filter by size bucket: keep where `selectedBuckets.includes(sizeOf(followerCount))` (§3).
9. Build target rows (`handle`,`platform`,`display_name`,`profile_url`,`follower_estimate`,`niche`,`language`,`for_apps`,`priority`, `contact_email`, `audience_size`, `notes:"[evomi-trial …]"`).
10. **DRY-RUN:** return rows as JSON. **COMMIT:** upsert (`on_conflict=platform,handle`, merge-duplicates) or `createOutreachTarget` per row; create/patch `klar_outreach_runs` audit row with `targets_added` + cost.
