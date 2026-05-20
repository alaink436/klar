# Ingest-Conversion · Per-App Rollout Guide

> **Goal:** every Klar app's paid revenue ends up in `referral_revenue_events`
> attributed to an influencer, so the existing Wise payout pipeline can
> pay out monthly.
>
> Two ingest functions exist:
> - **`revenuecat-webhook`** (Wavelength only, richer schema, already live)
> - **`affiliate-ingest`** (generic, for the other 5 apps, template in
>   `klar/migrations/templates/affiliate-ingest.ts`)

## Per-app status

| App | Project ID | Schema | Attribution-Path | RC-Webhook deployed | affiliate-ingest deployed |
|---|---|---|---|---|---|
| Wavelength | `yxhzwzgnbmpjztkvdudr` | richer | `referrals` (Shape A) | ✅ v8 | n/a (uses revenuecat-webhook) |
| Yarn-Stash | `zysmsgaordfkptzngntn` | generic | `profiles + influencer_codes` (Shape B) | ✅ v7 (entitlement only) | ❌ pending |
| Trubel | `hinivxigapnkrytpcqdl` | generic | `referrals` (Shape A) | ✅ v10 (entitlement only) | ❌ pending |
| MyLoo | `jkgymggxshtsljjvketi` | generic | `referrals` (Shape A) | ✅ v3 (entitlement only) | ❌ pending |
| Kelva | `absnjkjxbxeyekmcmpof` | generic | **❌ none** | ✅ v4 (entitlement only) | blocked on migration `0002` |
| Moto | `mpqapdnixzgolmfyckla` | generic | **❌ none** | ❌ none | blocked on migration `0002` |

"Entitlement only" means the existing `revenuecat-webhook` only flips
`user_entitlements.is_premium` and does NOT touch `referral_revenue_events`.
We keep it untouched; the new `affiliate-ingest` runs as a second RC webhook
destination so both concerns stay separated.

## Two schemas: Wavelength richer vs generic affiliates_v1_init

**Wavelength `referral_revenue_events` columns:**
```
rc_event_id (unique), user_id, influencer_handle, influencer_id,
app, rc_subscriber_id, product_id, event_type, event_at,
gross_revenue_cents, currency, share_cents, share_cents_eur,
counts_for_payout, note
```

**Generic `referral_revenue_events` columns (the 5 other apps):**
```
id, influencer_id, influencer_handle, event_at,
source, source_ref, gross_revenue_cents, gross_currency,
share_cents_eur, matured_at, refunded, raw_payload, created_at
```

The generic schema is leaner: no `event_type` column (the type goes into
`raw_payload`), no `counts_for_payout` boolean (we set `refunded=true` for
events that don't count), and `share_cents_eur` is the final EUR-normalized
share (no separate native-currency `share_cents` column).

## Three attribution shapes

**Shape A — `referrals` table lookup**
```ts
const { data: refs } = await sb.from("referrals")
  .select("user_id, influencer_handle")
  .in("user_id", userCandidates).limit(1);
const handle = refs[0].influencer_handle;
```
Used by Wavelength, Trubel, MyLoo. Requires the app to write `referrals`
rows server-side at sign-up.

**Shape B — `profiles.referred_by_code_id → influencer_codes` lookup**
```ts
const { data: prof } = await sb.from("profiles")
  .select("id, referred_by_code_id")
  .in("id", userCandidates)
  .not("referred_by_code_id", "is", null).limit(1);
const { data: code } = await sb.from("influencer_codes")
  .select("handle").eq("id", prof[0].referred_by_code_id).maybeSingle();
const handle = code.handle;
```
Used by Yarn-Stash. App writes the `referred_by_code_id` FK at first
cold-start via `capture_referral(code)` RPC.

**Shape C — no attribution path**
Kelva + Moto. Blocks ingest; apply `migrations/0002_attribution_for_kelva_moto.sql`
first (adds Shape-B path), then deploy ingest with `SHAPE="B"`.

## Per-app deploy checklist

For each app, the once-only sequence:

### 1) Schema migration (Kelva + Moto only)
```sql
-- Via Supabase MCP apply_migration with name "kelva_attribution_v1"
-- (or "moto_attribution_v1"):
-- Copy entire content of migrations/0002_attribution_for_kelva_moto.sql
```

### 2) Pick SHAPE + edit template
```
cp klar/migrations/templates/affiliate-ingest.ts /tmp/affiliate-ingest-yarnstash.ts
# In the file, edit the CONFIG block at the top:
const APP = "yarn-stash";   // or trubel / myloo / kelva / moto
const SHAPE = "B";          // A for Trubel/MyLoo, B for Yarn-Stash/Kelva/Moto
```

### 3) Set Supabase secret (per app)
Per-app secrets were generated 2026-05-20 and stored on the VPS at
`root@5.75.147.188:/root/affiliate-ingest-secrets.txt` (chmod 600).
SSH in, read the line for your app, then in the Supabase Dashboard for the
app's project:

```
Project Settings → Edge Functions → Secrets → Add new
Name:  RC_WEBHOOK_SECRET
Value: <paste the line from /root/affiliate-ingest-secrets.txt>
```

**Important:** never reuse a secret across apps (limits blast radius if one
leaks). Treat each as a credential.

### 4) Deploy the function

Via Supabase MCP `deploy_edge_function` with `verify_jwt: false`:
```json
{
  "project_id": "<app's project_id>",
  "name": "affiliate-ingest",
  "entrypoint_path": "index.ts",
  "verify_jwt": false,
  "files": [{"name": "index.ts", "content": "<paste the edited template>"}]
}
```

Or locally (if `supabase` CLI is in the app's repo):
```
supabase functions deploy affiliate-ingest --project-ref <ref> --no-verify-jwt
```

### 5) Configure RC webhook for the app

In RevenueCat dashboard → app's project → Integrations → Webhooks → Add:
- URL: `https://<app_project_ref>.supabase.co/functions/v1/affiliate-ingest`
- Authorization header: paste the same `RC_WEBHOOK_SECRET` value (no `Bearer ` prefix)
- Events: enable all (INITIAL_PURCHASE / RENEWAL / TRIAL_CONVERSION /
  PRODUCT_CHANGE / NON_RENEWING_PURCHASE / REFUND / CHARGEBACK /
  CANCELLATION / UNCANCELLATION / EXPIRATION)

This is a SECOND webhook alongside the existing `revenuecat-webhook` (which
toggles entitlement). Both fire on every event, decoupled concerns.

### 6) Smoke test

In RC dashboard click "Send test event" → function should return
`{"ok":true,"test":true}`. A sandbox purchase by a referred user → row in
`referral_revenue_events` with `refunded=true` (sandbox excluded) and
`raw_payload` containing the RC event.

### 7) Verify in Funnel

Open `getklar.org/admin/analytics?tab=funnel` → the app's card should now
show the test event under "Premium · Paid" if any non-sandbox events have
landed (sandbox events are stored but don't increment the counter because
they have `refunded=true`).

## Yarn-Stash dual-rail special

Yarn-Stash earns on TWO sources for the same affiliate:
1. **Premium subs (RC)** — via `affiliate-ingest` above (Shape B)
2. **Yarn-shop provisions (Awin)** — Knit Picks mid 89047 + Minerva mid 5270,
   tracked via `clickref=u_<userId>` on Awin deeplinks. Awin's
   `awin-postback` Edge Function (already deployed at Yarn-Stash) writes to
   `awin_conversions`.

Both rails are unified in the Klar Funnel view: it reads `referral_revenue_events`
(RC) + `awin_conversions` (Awin) and sums them as "Premium · Paid". No
schema change needed.

If you want one unified ledger later: add `event_type='awin_provision'` to
the generic events table and rewrite `awin-postback` to insert there (with
`source='awin'`). Stage 3-ish, not urgent.

## Roll-out priority

1. **Yarn-Stash** — App Store live, real users, real revenue → highest urgency
2. **Moto / ThrottleUp** — submit pending, traffic when Apple approves; apply 0002 first
3. **MyLoo** — iOS live, Android blocked on Google org policy
4. **Kelva** — Premium pivot fresh, apply 0002 first
5. **Trubel** — Reject-round 2 fix pending; deprioritize until live

Each is its own session, ~30 min:
- 5 min schema migration (only Kelva/Moto)
- 5 min edit + deploy ingest function
- 5 min secret + RC webhook config
- 5 min smoke test in RC dashboard
- 10 min buffer for surprises

## What's still missing after ALL ingest functions are live

- **Onboarding flow** (`/affiliate/apply` form on getklar.org +
  per-app domains, admin-approve button in `/admin/inbox`, auto-mint
  `influencer_codes` or `referrals` row) — Stage 2
- **App-side clipboard capture** in apps that don't have it yet
  (currently only Wavelength + Yarn-Stash) — per-app code change, separate
  PR per app repo
- **pg_cron monthly batch builder** per app — Stage 3
- **getklar.org landing pages** `/i/<app>/<code>` for apps that don't
  have them (currently only Yarn-Stash)

Per the affiliate-pipeline overview, ingest is **bauteil 4 of 5**. After
all 5 ingest functions are live, you still need bauteile 1, 2, 3 (onboarding,
landing, attribution in-app) before any affiliate can actually generate
events that hit ingest.
