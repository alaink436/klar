// @ts-nocheck
// Klar affiliate-ingest — Source-of-truth Template (S30c: Bearer-tolerant + OR-match).
// Per-App-Deployments (Stand 2026-05-22):
//   - Yarn-Stash  (zysmsgaordfkptzngntn) SHAPE=B  v5
//   - Trubel      (hinivxigapnkrytpcqdl) SHAPE=A  v7
//   - MyLoo       (jkgymggxshtsljjvketi) SHAPE=A  v5
//   - Kelva       (absnjkjxbxeyekmcmpof) SHAPE=B  v5
//   - Moto        (mpqapdnixzgolmfyckla) SHAPE=B  v6
//   - Promillio   (cmhxvhmxansithjjajld) SHAPE=B  v1 (2026-06-06)
//   - Wavelength  (yxhzwzgnbmpjztkvdudr) macht beides im richer revenuecat-webhook
//
// Auth: Authorization-Header wird gegen ENTWEDER RC_WEBHOOK_SECRET ODER
// REVENUECAT_WEBHOOK_SECRET im jeweiligen App-Supabase gematcht. Bearer-Prefix
// wird toleriert. Fail-closed wenn KEIN Secret gesetzt ist.
//
// Money model: share = influencer.share_pct % of NET revenue (price *
// takehome_percentage, also after store cut), capped to influencer.share_months
// from first subscription. Refund/chargeback => negative event (clawback).
// Sandbox / paused|terminated => counts_for_payout = false (recorded for
// audit, excluded from payout). FX to EUR best-effort via ECB (Frankfurter);
// null when unavailable -> surfaced as unnormalized, never mispaid.
// referral_revenue_events is the source of truth.
//
// Pro App musst du beim Deploy aus diesem Template zwei Konstanten anpassen:
//   - APP   = app-slug, z.B. "trubel"
//   - SHAPE = "A" (referrals-Tabelle, Klar Trubel/MyLoo) oder
//             "B" (profiles.referred_by_code_id, Yarn-Stash/Kelva/Moto)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const APP = "REPLACE_ME";              // z.B. "trubel"
const SHAPE: "A" | "B" = "A";          // A=referrals, B=influencer_codes
const SOURCE = "revenuecat";
const MATURATION_DAYS = 60;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVENUE_TYPES = new Set(["INITIAL_PURCHASE","RENEWAL","NON_RENEWING_PURCHASE","PRODUCT_CHANGE","TRIAL_CONVERSION"]);
const REFUND_TYPES = new Set(["REFUND","CHARGEBACK"]);

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a); const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let r = 0; for (let i = 0; i < ab.length; i++) r |= ab[i] ^ bb[i];
  return r === 0;
}

// True if `provided` matches EITHER configured secret. Each comparison is
// timing-safe; an empty configured-secret never matches.
function matchesEitherSecret(provided: string): boolean {
  const primary = Deno.env.get("RC_WEBHOOK_SECRET") ?? "";
  const fallback = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  if (!primary && !fallback) return false;
  const matchesPrimary = primary !== "" && timingSafeEqual(provided, primary);
  const matchesFallback = fallback !== "" && timingSafeEqual(provided, fallback);
  return matchesPrimary || matchesFallback;
}

function hasAnySecret(): boolean {
  return Boolean(Deno.env.get("RC_WEBHOOK_SECRET") || Deno.env.get("REVENUECAT_WEBHOOK_SECRET"));
}

const j = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return j(405, { error: "method_not_allowed" });
  if (!hasAnySecret()) return j(500, { error: "server_misconfigured_no_secret" });
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!matchesEitherSecret(provided)) return j(401, { error: "unauthorized" });

  let payload: any;
  try { payload = await req.json(); } catch { return j(400, { error: "bad_json" }); }
  const ev = payload?.event;
  if (!ev || typeof ev !== "object") return j(200, { ok: true, skipped: "no_event" });
  const type = String(ev.type ?? "").toUpperCase();
  if (type === "TEST") return j(200, { ok: true, test: true });
  const rcEventId = String(ev.id ?? "");
  if (!rcEventId) return j(200, { ok: true, skipped: "no_event_id" });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const userCandidates: string[] = [];
  for (const v of [ev.app_user_id, ev.original_app_user_id, ...(Array.isArray(ev.aliases) ? ev.aliases : [])]) {
    if (typeof v === "string" && UUID_RE.test(v)) userCandidates.push(v);
  }
  if (userCandidates.length === 0) return j(200, { ok: true, skipped: "no_uuid_user" });

  let handle: string | null = null;
  let influencerId: string | null = null;
  let sharePercent = 50;

  if (SHAPE === "A") {
    const { data: refs, error: refErr } = await sb.from("referrals").select("user_id, influencer_handle").in("user_id", userCandidates).limit(1);
    if (refErr) return j(500, { error: "referral_lookup_failed", detail: refErr.message });
    if (!refs || refs.length === 0) return j(200, { ok: true, skipped: "not_referred" });
    handle = refs[0].influencer_handle;
  } else if (SHAPE === "B") {
    const { data: prof, error: profErr } = await sb.from("profiles").select("id, referred_by_code_id").in("id", userCandidates).not("referred_by_code_id", "is", null).limit(1);
    if (profErr) return j(500, { error: "profile_lookup_failed", detail: profErr.message });
    if (!prof || prof.length === 0) return j(200, { ok: true, skipped: "not_referred" });
    const { data: code, error: codeErr } = await sb.from("influencer_codes").select("handle, commission_pct").eq("id", prof[0].referred_by_code_id).maybeSingle();
    if (codeErr) return j(500, { error: "code_lookup_failed", detail: codeErr.message });
    if (!code?.handle) return j(200, { ok: true, skipped: "orphan_code" });
    handle = code.handle;
    if (typeof code.commission_pct === "number") sharePercent = code.commission_pct * 100;
  } else {
    return j(500, { error: "config_unknown_shape", detail: SHAPE });
  }

  if (!handle) return j(200, { ok: true, skipped: "no_handle" });

  const { data: inf, error: infErr } = await sb.from("influencers").select("id, share_percent, status").eq("handle", handle).maybeSingle();
  if (infErr) return j(500, { error: "influencer_lookup_failed", detail: infErr.message });
  influencerId = inf?.id ?? null;
  if (inf?.share_percent != null) sharePercent = Number(inf.share_percent);

  const currency = String(ev.currency ?? "USD").toUpperCase();
  const rawPrice = Number(ev.price_in_purchased_currency ?? ev.price ?? 0) || 0;
  let takehome = Number(ev.takehome_percentage);
  if (!isFinite(takehome) || takehome <= 0 || takehome > 1) takehome = 0.7;
  const isRefund = REFUND_TYPES.has(type);
  const isRevenue = REVENUE_TYPES.has(type) || isRefund;
  const trialNoMoney = String(ev.period_type ?? "").toUpperCase() === "TRIAL" && rawPrice === 0;
  if (!isRevenue || trialNoMoney) return j(200, { ok: true, skipped: "non_revenue_event", type });

  const sign = isRefund ? -1 : 1;
  const grossCents = Math.round(rawPrice * 100) * sign;
  const shareCents = Math.round(rawPrice * takehome * 100 * (sharePercent / 100)) * sign;

  let countsForPayout = shareCents !== 0;
  if (String(ev.environment ?? "").toUpperCase() === "SANDBOX") countsForPayout = false;
  if (inf?.status === "suspended" || inf?.status === "banned") countsForPayout = false;

  const eventAtMs = Number(ev.purchased_at_ms ?? ev.event_timestamp_ms ?? Date.now());
  const eventAt = new Date(isFinite(eventAtMs) ? eventAtMs : Date.now());
  let shareCentsEur: number | null = null;
  if (!countsForPayout || shareCents === 0) shareCentsEur = 0;
  else if (currency === "EUR") shareCentsEur = shareCents;
  else {
    try {
      const d = eventAt.toISOString().slice(0, 10);
      const r = await fetch(`https://api.frankfurter.app/${d}?from=${currency}&to=EUR`);
      if (r.ok) { const fx = await r.json(); const rate = fx?.rates?.EUR; if (typeof rate === "number" && rate > 0) shareCentsEur = Math.round(shareCents * rate); }
    } catch (_e) {}
  }

  const maturedAt = new Date(eventAt);
  maturedAt.setDate(maturedAt.getDate() + MATURATION_DAYS);

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
    if ((insErr as { code?: string }).code === "23505") return j(200, { ok: true, duplicate: true });
    return j(500, { error: "event_insert_failed", detail: insErr.message });
  }

  return j(200, { ok: true, app: APP, processed: type, counts_for_payout: countsForPayout, share_cents_eur: shareCentsEur });
});
