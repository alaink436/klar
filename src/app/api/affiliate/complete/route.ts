// Public-facing completion endpoint for the Klar-hosted onboarding pages
// (Yarn-Stash + ThrottleUp fallback). The sister-repo apps (Trubel/MyLoo/
// Wavelength/Kelva) hit `complete_influencer_setup` directly with their own
// anon-key from the browser — they don't need this proxy.
//
// Why a proxy here: Klar doesn't ship the Yarn-Stash / ThrottleUp anon-key
// in its bundle (would expose the wrong tenant's project), so the browser
// posts to Klar, and Klar's server forwards the call to the right app's
// Supabase using the service-role key from KLAR_ADMIN_APPS.
//
// Side-effects layered on top of the RPC:
//   - The click-through agreement is logged in anime-vault.affiliate_agreements
//     with IP + UA + agreement_version so it's auditable later.
//   - A confirmation email is fired via the anime-vault edge function
//     affiliate-confirmation-email. Both are best-effort: if either fails
//     we still return ok=true for the onboarding because the influencer's
//     setup itself already succeeded.

import { NextResponse, type NextRequest } from "next/server";
import { getApp, sbRpc } from "@/lib/adminApps";
import { ALLOWED_ORIGINS, isAllowedOrigin, clientIp, rateLimit, exceedsContentLength } from "@/lib/apiGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024;        // 8 KB is plenty for a payout form
const RATE_MAX = 5;
const RATE_WINDOW_MS = 10 * 60_000; // 5 submits / 10 min / IP

function corsHeaders(origin: string | null): HeadersInit {
  // Echo back the origin if it's allow-listed; otherwise null (still readable
  // by same-origin callers, just no cross-origin grant).
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://getklar.org";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const COUNTRY_RE = /^[A-Z]{2,8}$/;
const PAYOUT_METHODS = new Set(["wise", "paypal", "sepa", "manual"]);

const AGREEMENT_VERSION = "v1.0-2026-05-21";
const KLAR_DOMAIN_BY_APP: Record<string, { host: string; appName: string; commissionPct: number; attributionMonths: number }> = {
  "yarn-stash": { host: "yarnstash", appName: "Yarn-Stash", commissionPct: 50, attributionMonths: 24 },
  moto:         { host: "throttleup", appName: "ThrottleUp", commissionPct: 25, attributionMonths: 12 },
  wavelength:   { host: "wavelength", appName: "Wavelength", commissionPct: 30, attributionMonths: 12 },
  kelva:        { host: "kelva", appName: "Kelva", commissionPct: 28, attributionMonths: 12 },
  trubel:       { host: "trubel", appName: "Trubel", commissionPct: 50, attributionMonths: 24 },
  myloo:        { host: "myloo", appName: "MyLoo", commissionPct: 26, attributionMonths: 12 },
};

function bad(req: NextRequest, message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status, headers: corsHeaders(req.headers.get("origin")) });
}

async function logAgreement(args: {
  appSlug: string;
  influencerId: string;
  displayName: string;
  contactEmail: string | null;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ signed_at: string } | null> {
  // Match the fallback used by /api/track + /api/cal-webhook + /api/affiliate/approve.
  // Production prod-env only sets KLAR_INBOX_SERVICE_KEY explicitly; the URL is hardcoded
  // to anime-vault as a fallback so the agreement-log never silently skips when only the
  // URL var is absent.
  const url = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
  const key = process.env.KLAR_INBOX_SERVICE_KEY;
  if (!key) {
    console.warn("[affiliate/complete] KLAR_INBOX_SERVICE_KEY env missing, agreement not logged");
    return null;
  }
  try {
    const res = await fetch(`${url}/rest/v1/affiliate_agreements`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        app_slug: args.appSlug,
        influencer_id: args.influencerId,
        display_name: args.displayName,
        contact_email: args.contactEmail,
        agreement_version: AGREEMENT_VERSION,
        ip_address: args.ip,
        user_agent: args.userAgent,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[affiliate/complete] agreement insert ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    const rows = (await res.json().catch(() => null)) as Array<{ signed_at: string }> | null;
    return rows?.[0] ?? null;
  } catch (e) {
    console.warn("[affiliate/complete] agreement insert threw", e);
    return null;
  }
}

async function fireConfirmationEmail(payload: {
  app_slug: string;
  app_name: string;
  handle: string;
  display_name: string;
  contact_email: string;
  tracking_url: string;
  commission_pct: number;
  attribution_months: number;
  assets_drive_url: string | null;
  agreement_version: string;
  signed_at: string;
  language: "de" | "en";
}): Promise<void> {
  // Same fallback pattern as logAgreement — anime-vault host is hardcoded so only the
  // admin-key needs to be set explicitly for the confirmation email to fire.
  const url = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
  const adminKey = process.env.KLAR_AGREEMENT_ADMIN_KEY;
  const serviceKey = process.env.KLAR_INBOX_SERVICE_KEY;
  if (!adminKey || !serviceKey) {
    console.warn("[affiliate/complete] KLAR_AGREEMENT_ADMIN_KEY or KLAR_INBOX_SERVICE_KEY env missing, confirmation-email skip");
    return;
  }
  try {
    // Edge function has verify_jwt: true, so the Supabase gateway needs an
    // Authorization: Bearer <JWT> header on top of x-admin-key. Service-role
    // key is itself a valid JWT, so we reuse it for both apikey + bearer.
    const res = await fetch(`${url}/functions/v1/affiliate-confirmation-email`, {
      method: "POST",
      headers: {
        "x-admin-key": adminKey,
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[affiliate/complete] email send ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn("[affiliate/complete] email send threw", e);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!isAllowedOrigin(req)) return bad(req, "forbidden origin", 403);
  if (exceedsContentLength(req, MAX_BYTES)) return bad(req, "payload too large", 413);
  const rl = rateLimit("affiliate-complete", clientIp(req), RATE_MAX, RATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, {
      status: 429,
      headers: { ...corsHeaders(req.headers.get("origin")), "Retry-After": String(rl.retryAfterSeconds) },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad(req,"bad json");
  }

  const appSlug = String(payload.app ?? "").trim();
  const token = String(payload.token ?? "").trim();
  const displayName = String(payload.display_name ?? "").trim();
  const country = String(payload.country ?? "").trim().toUpperCase();
  const payoutMethod = String(payload.payout_method ?? "").trim().toLowerCase();
  const payoutEmail = String(payload.payout_email ?? "").trim().toLowerCase();
  const payoutIban = String(payload.payout_iban ?? "").trim().toUpperCase();
  const taxStatus = String(payload.tax_status ?? "unknown").trim().toLowerCase();
  const invoiceCapable = Boolean(payload.invoice_capable);
  const promoCode = String(payload.promo_code ?? "").trim().toUpperCase();
  const agreementAccepted = Boolean(payload.agreement_accepted);
  const contactEmail = String(payload.contact_email ?? payload.payout_email ?? "").trim().toLowerCase() || null;
  const assetsDriveUrl = typeof payload.assets_drive_url === "string" ? payload.assets_drive_url : null;

  if (!appSlug) return bad(req, "missing app");
  if (token.length < 16) return bad(req, "invalid token");
  if (!displayName) return bad(req, "missing display_name");
  if (!COUNTRY_RE.test(country)) return bad(req, "invalid country");
  if (!PAYOUT_METHODS.has(payoutMethod)) return bad(req, "invalid payout_method");
  if (promoCode && !HANDLE_RE.test(promoCode)) return bad(req, "invalid promo_code");
  if (payoutMethod === "sepa" && !payoutIban) return bad(req, "missing iban");
  if ((payoutMethod === "wise" || payoutMethod === "paypal") && !payoutEmail) {
    return bad(req, "missing payout_email");
  }
  if (!agreementAccepted) return bad(req, "agreement_not_accepted");

  const app = getApp(appSlug);
  if (!app) return bad(req, `unknown app: ${appSlug}`);

  let row: { promo_code?: string; handle?: string; id?: string; contact_email?: string; language?: string };
  try {
    row = await sbRpc<{ promo_code?: string; handle?: string; id?: string; contact_email?: string; language?: string }>(app, "complete_influencer_setup", {
      p_token: token,
      p_display_name: displayName,
      p_country: country,
      p_payout_method: payoutMethod,
      p_payout_email: payoutMethod === "sepa" ? null : payoutEmail || null,
      p_payout_iban: payoutMethod === "sepa" ? payoutIban : null,
      p_tax_status: taxStatus,
      p_invoice_capable: invoiceCapable,
      p_promo_code: promoCode || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return bad(req,msg, 502);
  }

  // Best-effort side-effects: agreement log + confirmation email. Failures
  // here are non-blocking, the onboarding itself already succeeded.
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");
  const handle = row.handle ?? displayName.split(/\s+/)[0]?.toLowerCase() ?? "creator";
  let finalPromo = row.promo_code ?? promoCode ?? "";
  const meta = KLAR_DOMAIN_BY_APP[appSlug];
  // Prefer the contact_email that was set at create_influencer_setup time
  // (token mint), fall back to the payout email the user just entered.
  const sendEmail = row.contact_email ?? contactEmail;

  // Auto-mint an internal influencer_codes row from the handle when the
  // onboarding finished without a promo_code. This keeps the App-side
  // referral capture (yarn-stash + moto match on influencer_codes.code)
  // working without surfacing the code anywhere user-facing — the Affiliate
  // only ever sees the tracking link, the code is just an internal slug.
  // Trubel matches on referrals.influencer_handle directly, so it doesn't
  // need this. The other apps (wavelength, kelva, myloo) are skipped until
  // their app-side capture is wired up.
  if (!finalPromo && (appSlug === "yarn-stash" || appSlug === "moto")) {
    // The RPC enforces uppercase A-Z 0-9 _ . - and a 2-32 length window.
    // Trim down handles that overflow so the regex passes; reject < 2.
    const autoCode = handle
      .toUpperCase()
      .replace(/[^A-Z0-9_.-]/g, "")
      .slice(0, 32);
    // RPC contract: commission_pct is a DECIMAL between 0 and 1, not percent.
    // (Cross-project learning: Supabase RPCs that return { error } in JSON
    // payload instead of raising must be checked at every call-site.)
    const commissionDecimal = (meta?.commissionPct ?? 50) / 100;
    if (autoCode.length >= 2) {
      try {
        const result = await sbRpc<{
          success?: boolean;
          code?: string;
          error?: string;
          detail?: string;
        }>(app, "admin_create_influencer_code", {
          p_code: autoCode,
          p_display_name: displayName,
          p_handle: handle,
          p_commission_pct: commissionDecimal,
        });
        if (result?.success) {
          finalPromo = result.code ?? autoCode;
        } else if (result?.error === "CODE_EXISTS") {
          // Idempotent: the row is already there from a prior run, reuse it.
          finalPromo = autoCode;
        } else {
          console.warn("[affiliate/complete] auto-mint returned error", result?.error, result?.detail);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
          finalPromo = autoCode;
        } else {
          console.warn("[affiliate/complete] auto-mint threw", msg);
        }
      }
    }
  }

  const agreement = await logAgreement({
    appSlug,
    influencerId: row.id ?? "00000000-0000-0000-0000-000000000000",
    displayName,
    contactEmail: sendEmail,
    ip,
    userAgent: ua,
  });

  if (sendEmail && meta) {
    // Tracking URL uses the per-influencer code as path segment (the
    // /i/<host>/<code> route validates against the app's influencer_codes
    // table for yarn-stash + moto; trubel matches on the handle directly).
    // It's an internal identifier — the Affiliate never sees it as a "promo
    // code" anymore in mail/PDF/UI, it's just part of the link.
    const trackingSlug = finalPromo || handle || row.id || "creator";
    const trackingUrl = `https://getklar.org/i/${meta.host}/${trackingSlug}`;
    const language: "de" | "en" = row.language === "en" ? "en" : "de";
    fireConfirmationEmail({
      app_slug: appSlug,
      app_name: meta.appName,
      handle,
      display_name: displayName,
      contact_email: sendEmail,
      tracking_url: trackingUrl,
      commission_pct: meta.commissionPct,
      attribution_months: meta.attributionMonths,
      assets_drive_url: assetsDriveUrl,
      agreement_version: AGREEMENT_VERSION,
      signed_at: agreement?.signed_at ?? new Date().toISOString(),
      language,
    }).catch(() => { /* already logged */ });
  }

  return NextResponse.json({ ok: true, promo_code: finalPromo || null, handle: row.handle ?? null }, {
    headers: corsHeaders(req.headers.get("origin")),
  });
}
