# Ingest-Conversion Template

> How to add the **conversion ingest** (RevenueCat webhook → `referral_revenue_events`)
> to one of the 5 apps that don't have it yet (Yarn-Stash / Trubel / MyLoo /
> Kelva / Moto). Wavelength already has it as `revenuecat-webhook` v8 — that
> function is the reference.

## What it does

Receives a RevenueCat webhook on every paid event (`INITIAL_PURCHASE`,
`RENEWAL`, `TRIAL_CONVERSION`, `REFUND`, `CHARGEBACK`, etc), maps the buying
user to the influencer who referred them, calculates the influencer's share
(default 50% of NET, capped at 24 months from first sub), and writes a
`referral_revenue_events` row that the payout pipeline picks up.

Guard rails (each adds a `note` and sets `counts_for_payout=false` instead of
silently dropping the event, so the audit trail stays complete):

- `sandbox` — RC test mode events
- `self_referral` — buyer's email matches the influencer's `contact_email`
- `influencer_paused` / `influencer_terminated`
- `beyond_cap` — event_at > first_subscribe_at + share_months
- `takehome_defaulted_0.7` — RC didn't send takehome_percentage, assumed 70%
- `fx_failed` / `fx_no_rate` / `fx_http_<code>` — Frankfurter API failed for
  the day, `share_cents_eur` stays NULL until backfilled (never mispaid)

## Two schema shapes

### Shape A: Wavelength-rich (referrals lookup)

`referrals(user_id, app, influencer_handle)` exists and is populated by the
clipboard / universal-link attribution flow at install time. The webhook
looks up the row by RC `app_user_id` (a UUID matching the auth user_id).

This is what `revenuecat-webhook` v8 does. Reference:
`yxhzwzgnbmpjztkvdudr` → Edge Functions → `revenuecat-webhook` → `index.ts`.

### Shape B: Code-based (Yarn-Stash, generic)

No `referrals` table. Instead, install attribution writes
`profiles.referred_by_code_id` → FK into `influencer_codes(id, code, influencer_handle)`.

The webhook needs an extra JOIN:

```ts
// Instead of:
//   from('referrals').select('user_id, influencer_handle').in('user_id', uuids)
// do:
const { data: prof } = await sb
  .from('profiles')
  .select('id, referred_by_code_id')
  .in('id', uuidCandidates)
  .not('referred_by_code_id', 'is', null)
  .limit(1);
if (!prof?.length) return j(200, { ok: true, skipped: 'not_referred' });

const { data: code } = await sb
  .from('influencer_codes')
  .select('influencer_handle')
  .eq('id', prof[0].referred_by_code_id)
  .maybeSingle();
if (!code?.influencer_handle) return j(200, { ok: true, skipped: 'orphan_code' });

const handle = code.influencer_handle;
const userId = prof[0].id;
// continue identical to Wavelength webhook from here
```

## Yarn-Stash dual-path special

Yarn-Stash earns from **two** sources for the same affiliate:

1. **Premium Subs (RC):** standard ingest as above (Shape B)
2. **Shop Provisions (Awin):** Knit Picks (mid 89047) + Minerva (mid 5270),
   tracked via `clickref=u_<userId>` on the Awin deeplink, paid via
   Awin-Postback to a separate endpoint.

For now `awin_conversions` is its own table fed by the (still-to-be-built)
`awin-postback` Edge Function. Funnel already merges both: see
`fetchAppInstallsAndPremiums` in `klar/src/app/admin/analytics/page.tsx`.

To unify both rails into `referral_revenue_events` later: write the Awin
postback into the same table with `event_type='awin_provision'` (add to the
enum) so the same payout pipeline handles it. Don't do this until Awin
Postback E2E is bewiesen with a test purchase, per Yarn-Stash PROGRESS.

## Per-app deploy checklist

For each of the 5 remaining apps, this is the **once-per-app** sequence:

1. **Pick schema shape**
   - Shape A if `referrals` table exists
   - Shape B otherwise

2. **Copy `revenuecat-webhook` source** from Wavelength as starting point
   - Change `const APP = "wavelength"` → app slug
   - If Shape B: swap the `referrals` lookup for the `profiles +
     influencer_codes` JOIN (see snippet above)
   - Keep everything else byte-identical (guards, FX, dedup, summary update)

3. **Set Supabase secrets** in the app's project (Supabase Dashboard →
   Settings → Edge Functions → Secrets):
   - `RC_WEBHOOK_SECRET` = a fresh `openssl rand -base64 32` per app, never
     reused across apps
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are injected by the runtime,
     do NOT set them

4. **Deploy the function** (locally from `klar` repo):
   ```
   cd /path/to/app   # NOT the klar repo
   npx supabase functions deploy revenuecat-webhook --project-ref <app_project_ref>
   ```
   Or via Supabase MCP `deploy_edge_function` from Klar admin.

5. **Configure RC webhook** in RevenueCat dashboard for the app's RC project:
   - URL: `https://<app_project_ref>.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: paste the same `RC_WEBHOOK_SECRET` value verbatim
     (the function does a `timingSafeEqual` against the full header value)
   - Events: enable all (INITIAL_PURCHASE / RENEWAL / TRIAL_CONVERSION /
     PRODUCT_CHANGE / NON_RENEWING_PURCHASE / REFUND / CHARGEBACK /
     CANCELLATION / UNCANCELLATION / EXPIRATION)

6. **Smoke test** in RC dashboard: "Send test event" → Function should return
   `{"ok":true,"test":true}`. A real test purchase (sandbox) should return
   `{"ok":true,"processed":"initial_purchase","counts_for_payout":false,...}`
   (false because sandbox is excluded; check `referral_revenue_events` table,
   the row should be there with `note='sandbox'`).

7. **Wire into Funnel view**: nothing to do — the Funnel in
   `/admin/analytics?tab=funnel` already reads `referral_revenue_events` and
   will pick up the new app as soon as the first real event lands.

## Roll-out priority recommendation

1. **Yarn-Stash** — App Store live, real users, dual-rail (RC + Awin). Most
   urgent because outreach uses YS-affiliate codes already.
2. **Moto / ThrottleUp** — App Store submitted, traffic when Apple approves.
3. **MyLoo** — iOS submitted, Android blocked on Google org-policy.
4. **Kelva** — Live, RC premium pivot fresh (revenuecat-webhook deployed at
   Kelva already, may need only minor adapt).
5. **Trubel** — Reject-round 2 fixes pending; deprioritize until live.

Each is its own session (~1-2h with the template above, more if RC dashboard
config trips up — that's the slowest step, not the code).

## Open gaps after ingest is everywhere

- `awin-postback` Edge Function (Yarn-Stash dual-rail)
- Onboarding-flow on getklar.org `/affiliate/apply` + admin-approve button
  → mint `influencers` row + `influencer_codes` (Shape B) or `referrals` seed (Shape A)
- pg_cron monthly batch-builder (per app) — gather matured events ≥ MIN_PAYOUT
  into `influencer_payout_items`, then `/admin/dispatch-all` triggers Wise

These are Stage 2 + Stage 3 of the original 3-stage plan. Ingest is Stage 1.
