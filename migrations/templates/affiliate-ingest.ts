// @ts-nocheck
// Generic affiliate-ingest Edge Function for Klar apps using the generic
// `affiliates_v1_init` schema (Yarn-Stash / Trubel / MyLoo / Kelva / Moto).
//
// Wavelength uses a separate richer schema with its own dedicated
// `revenuecat-webhook`. Do NOT deploy this template to Wavelength.
//
// To roll this out to one of the 5 apps, copy the file, change ONLY the
// CONFIG block at the top, then deploy via:
//   supabase functions deploy affiliate-ingest --project-ref <ref>
// And set the per-app secret in the app's Supabase project:
//   supabase secrets set RC_WEBHOOK_SECRET=<per-app secret from VPS>
//   (NEVER reuse across apps; per-app values are on
//    root@5.75.147.188:/root/affiliate-ingest-secrets.txt)
//
// In the RC dashboard for the app, add a webhook:
//   URL: https://<ref>.supabase.co/functions/v1/affiliate-ingest
//   Authorization header: <the secret> (no "Bearer " prefix)
//   Events: enable all (INITIAL_PURCHASE, RENEWAL, TRIAL_CONVERSION,
//     PRODUCT_CHANGE, NON_RENEWING_PURCHASE, REFUND, CHARGEBACK,
//     CANCELLATION, UNCANCELLATION, EXPIRATION)
//
// This is a SEPARATE function from each app's existing `revenuecat-webhook`
// (which only toggles entitlement). Two RC webhooks per app is fine: RC
// allows multiple destinations, the entitlement-toggle stays untouched.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ===== CONFIG (change per app) =====
const APP = "TEMPLATE";           // "yarn-stash" / "trubel" / "myloo" / "kelva" / "moto"
const SHAPE: "A" | "B" = "A";     // A = referrals lookup, B = profiles+codes lookup
const SOURCE = "revenuecat";      // gets written to referral_revenue_events.source
// Refund-window: how long after the event do we wait before paying out.
// Apple/Google honor refund windows up to 60 days post-purchase.
const MATURATION_DAYS = 60;
// =====================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET = Deno.env.get("RC_WEBHOOK_SECRET") ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RC event types we consider revenue (positive). REFUND/CHARGEBACK are negative.
const REVENUE_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "TRIAL_CONVERSION",
]);
const REFUND_TYPES = new Set(["REFUND", "CHARGEBACK"]);

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let r = 0;
  for (let i = 0; i < ab.length; i++) r |= ab[i] ^ bb[i];
  return r === 0;
}

const j = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return j(405, { error: "method_not_allowed" });
  if (!RC_SECRET) return j(500, { error: "server_misconfigured_no_secret" });

  const auth = req.headers.get("Authorization") ?? "";
  if (!timingSafeEqual(auth, RC_SECRET)) return j(401, { error: "unauthorized" });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return j(400, { error: "bad_json" });
  }

  const ev = payload?.event;
  if (!ev || typeof ev !== "object") return j(200, { ok: true, skipped: "no_event" });
  const type = String(ev.type ?? "").toUpperCase();
  if (type === "TEST") return j(200, { ok: true, test: true });

  const rcEventId = String(ev.id ?? "");
  if (!rcEventId) return j(200, { ok: true, skipped: "no_event_id" });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ----- USER → INFLUENCER LOOKUP (shape-dependent) -----
  const userCandidates: string[] = [];
  for (
    const v of [ev.app_user_id, ev.original_app_user_id, ...(Array.isArray(ev.aliases) ? ev.aliases : [])]
  ) {
    if (typeof v === "string" && UUID_RE.test(v)) userCandidates.push(v);
  }
  if (userCandidates.length === 0) {
    return j(200, { ok: true, skipped: "no_uuid_user" });
  }

  let handle: string | null = null;
  let influencerId: string | null = null;
  let sharePercent = 50; // default

  if (SHAPE === "A") {
    // Look up in referrals table by user_id.
    // Schema: referrals(user_id uuid, influencer_handle text, app text?)
    const { data: refs, error: refErr } = await sb
      .from("referrals")
      .select("user_id, influencer_handle")
      .in("user_id", userCandidates)
      .limit(1);
    if (refErr) return j(500, { error: "referral_lookup_failed", detail: refErr.message });
    if (!refs || refs.length === 0) return j(200, { ok: true, skipped: "not_referred" });
    handle = refs[0].influencer_handle;
  } else if (SHAPE === "B") {
    // Look up via profiles.referred_by_code_id → influencer_codes → handle
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("id, referred_by_code_id")
      .in("id", userCandidates)
      .not("referred_by_code_id", "is", null)
      .limit(1);
    if (profErr) return j(500, { error: "profile_lookup_failed", detail: profErr.message });
    if (!prof || prof.length === 0) return j(200, { ok: true, skipped: "not_referred" });

    const { data: code, error: codeErr } = await sb
      .from("influencer_codes")
      .select("handle, commission_pct")
      .eq("id", prof[0].referred_by_code_id)
      .maybeSingle();
    if (codeErr) return j(500, { error: "code_lookup_failed", detail: codeErr.message });
    if (!code?.handle) return j(200, { ok: true, skipped: "orphan_code" });
    handle = code.handle;
    if (typeof code.commission_pct === "number") sharePercent = code.commission_pct * 100;
  } else {
    return j(500, { error: "config_unknown_shape", detail: SHAPE });
  }

  if (!handle) return j(200, { ok: true, skipped: "no_handle" });

  // Look up the influencer row to get id + share_percent override
  const { data: inf, error: infErr } = await sb
    .from("influencers")
    .select("id, share_percent, status")
    .eq("handle", handle)
    .maybeSingle();
  if (infErr) return j(500, { error: "influencer_lookup_failed", detail: infErr.message });
  influencerId = inf?.id ?? null;
  if (inf?.share_percent != null) sharePercent = Number(inf.share_percent);

  // ----- MONEY CALC -----
  const currency = String(ev.currency ?? "USD").toUpperCase();
  const rawPrice = Number(ev.price_in_purchased_currency ?? ev.price ?? 0) || 0;
  let takehome = Number(ev.takehome_percentage);
  if (!isFinite(takehome) || takehome <= 0 || takehome > 1) takehome = 0.7;

  const isRefund = REFUND_TYPES.has(type);
  const isRevenue = REVENUE_TYPES.has(type) || isRefund;
  const trialNoMoney = String(ev.period_type ?? "").toUpperCase() === "TRIAL" && rawPrice === 0;

  if (!isRevenue || trialNoMoney) {
    return j(200, { ok: true, skipped: "non_revenue_event", type });
  }

  const sign = isRefund ? -1 : 1;
  const grossCents = Math.round(rawPrice * 100) * sign;
  // share = NET (price * takehome) * share_percent
  const shareCents = Math.round(rawPrice * takehome * 100 * (sharePercent / 100)) * sign;

  // ----- GUARDS (write event but flag via refunded/share=0 if invalid) -----
  let countsForPayout = shareCents !== 0;
  const isSandbox = String(ev.environment ?? "").toUpperCase() === "SANDBOX";
  if (isSandbox) countsForPayout = false;
  if (inf?.status === "suspended" || inf?.status === "banned") countsForPayout = false;

  // ----- FX → EUR -----
  const eventAtMs = Number(ev.purchased_at_ms ?? ev.event_timestamp_ms ?? Date.now());
  const eventAt = new Date(isFinite(eventAtMs) ? eventAtMs : Date.now());
  let shareCentsEur: number | null = null;
  if (!countsForPayout || shareCents === 0) {
    shareCentsEur = 0;
  } else if (currency === "EUR") {
    shareCentsEur = shareCents;
  } else {
    try {
      const d = eventAt.toISOString().slice(0, 10);
      const r = await fetch(`https://api.frankfurter.app/${d}?from=${currency}&to=EUR`);
      if (r.ok) {
        const fx = await r.json();
        const rate = fx?.rates?.EUR;
        if (typeof rate === "number" && rate > 0) {
          shareCentsEur = Math.round(shareCents * rate);
        }
      }
    } catch (_e) {
      // leave null — backfill manually if Frankfurter was down
    }
  }

  const maturedAt = new Date(eventAt);
  maturedAt.setDate(maturedAt.getDate() + MATURATION_DAYS);

  // ----- INSERT EVENT (generic schema: source/source_ref/share_cents_eur) -----
  // Dedup on source_ref unique constraint if present (else duplicate rows on
  // RC redeliveries; downstream payout query should DISTINCT on source_ref).
  const { error: insErr } = await sb.from("referral_revenue_events").insert({
    influencer_id: influencerId,
    influencer_handle: handle,
    event_at: eventAt.toISOString(),
    source: SOURCE,
    source_ref: rcEventId,
    gross_revenue_cents: grossCents,
    gross_currency: currency,
    share_cents_eur: shareCentsEur,
    matured_at: maturedAt.toISOString(),
    refunded: isRefund || !countsForPayout,
    raw_payload: ev,
  });
  if (insErr) {
    // unique constraint on source_ref → already ingested, no-op
    if ((insErr as { code?: string }).code === "23505") {
      return j(200, { ok: true, duplicate: true });
    }
    return j(500, { error: "event_insert_failed", detail: insErr.message });
  }

  return j(200, {
    ok: true,
    app: APP,
    processed: type,
    counts_for_payout: countsForPayout,
    share_cents_eur: shareCentsEur,
  });
});
