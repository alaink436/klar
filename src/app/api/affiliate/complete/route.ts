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
import { getTrackingUrl } from "@/app/affiliate/_shared/brands";
import { AGREEMENT_VERSION, APP_TO_BRAND, APP_META } from "@/lib/affiliateApps";
import { renderAgreementPdf } from "@/lib/affiliateAgreementPdf";
import { getAdminSettings, logNotifEvent } from "@/lib/adminSettings";
import { flushNotifsIfBatchReady } from "@/lib/notifFlusher";

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
// Wise is the only payout rail we currently support. PayPal + SEPA are out
// of scope until those rails are configured on our side. The onboarding UI
// only ever sends "wise", so anything else is a programmer error or a
// crafted request and gets rejected.
const PAYOUT_METHODS = new Set(["wise"]);

// AGREEMENT_VERSION, APP_TO_BRAND and APP_META now live in @/lib/affiliateApps
// so the agreement-pdf download route shares the exact same per-app figures.

// Private storage bucket (anime-vault) holding the signed agreement PDFs.
// service-role only, no public access. Created via migration
// create_affiliate_agreements_bucket.
const AGREEMENTS_BUCKET = "affiliate-agreements";

// anime-vault host fallback, mirrors logAgreement / fireConfirmationEmail: only
// the service key needs to be set explicitly in prod, the URL defaults here.
const INBOX_URL = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";

function slugifyHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_.-]/g, "") || "creator";
}

// Render the stamped agreement PDF and upload it to the private bucket under
// <handle>/<app_slug>-<YYYY-MM-DD>.pdf. Throws on any failure so the caller can
// keep the onboarding on the sign step (with the setup-token still unspent)
// instead of advancing to a "live" state without a stored signed contract.
// x-upsert lets a retry overwrite the same deterministic path idempotently.
async function renderAndStoreAgreement(args: {
  appSlug: string;
  handleSlug: string;
  appName: string;
  displayName: string;
  contactEmail: string;
  trackingUrl: string;
  commissionPct: number;
  attributionMonths: number;
  signerName: string;
  signedAtIso: string;
}): Promise<string> {
  const key = process.env.KLAR_INBOX_SERVICE_KEY;
  if (!key) throw new Error("agreement storage not configured (KLAR_INBOX_SERVICE_KEY missing)");

  const bytes = await renderAgreementPdf({
    app_name: args.appName,
    handle: args.handleSlug,
    display_name: args.displayName,
    contact_email: args.contactEmail || "-",
    tracking_url: args.trackingUrl,
    commission_pct: args.commissionPct,
    attribution_months: args.attributionMonths,
    agreement_version: AGREEMENT_VERSION,
    signed_at: args.signedAtIso,
    language: "en",
    signer_name: args.signerName,
  });

  const dateSlug = args.signedAtIso.slice(0, 10);
  const path = `${args.handleSlug}/${args.appSlug}-${dateSlug}.pdf`;
  const res = await fetch(`${INBOX_URL}/storage/v1/object/${AGREEMENTS_BUCKET}/${encodeURI(path)}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/pdf",
      "x-upsert": "true",
    },
    body: Buffer.from(bytes),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`agreement upload ${res.status}: ${text.slice(0, 200)}`);
  }
  return path;
}

function bad(req: NextRequest, message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status, headers: corsHeaders(req.headers.get("origin")) });
}

async function logAgreement(args: {
  appSlug: string;
  influencerId: string;
  displayName: string;
  contactEmail: string | null;
  signerName: string | null;
  storagePath: string | null;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ signed_at: string } | null> {
  // Match the fallback used by /api/track + /api/cal-webhook + /api/affiliate/approve.
  // Production prod-env only sets KLAR_INBOX_SERVICE_KEY explicitly; the URL is hardcoded
  // to anime-vault as a fallback so the agreement-log never silently skips when only the
  // URL var is absent.
  const url = INBOX_URL;
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
        signer_name: args.signerName,
        storage_path: args.storagePath,
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
  const taxStatus = String(payload.tax_status ?? "unknown").trim().toLowerCase();
  const invoiceCapable = Boolean(payload.invoice_capable);
  const promoCode = String(payload.promo_code ?? "").trim().toUpperCase();
  const agreementAccepted = Boolean(payload.agreement_accepted);
  const contactEmail = String(payload.contact_email ?? payload.payout_email ?? "").trim().toLowerCase() || null;
  const assetsDriveUrl = typeof payload.assets_drive_url === "string" ? payload.assets_drive_url : null;
  // Online-signing fields (sign step). signature_name is the typed full legal
  // name; handle is sent so the stored PDF lands under a stable folder.
  const signatureName = String(payload.signature_name ?? "").trim();
  const bodyHandle = String(payload.handle ?? "").trim();

  if (!appSlug) return bad(req, "missing app");
  if (token.length < 16) return bad(req, "invalid token");
  if (!displayName) return bad(req, "missing display_name");
  if (!COUNTRY_RE.test(country)) return bad(req, "invalid country");
  if (!PAYOUT_METHODS.has(payoutMethod)) return bad(req, "invalid payout_method");
  if (promoCode && !HANDLE_RE.test(promoCode)) return bad(req, "invalid promo_code");
  if (!payoutEmail) return bad(req, "missing payout_email");
  if (!agreementAccepted) return bad(req, "agreement_not_accepted");
  // Gate: no signature -> no completion -> no live step. The onboarding only
  // calls this from the sign step, which requires a typed name.
  if (signatureName.length < 2 || signatureName.length > 120) return bad(req, "signature_required");

  const app = getApp(appSlug);
  if (!app) return bad(req, `unknown app: ${appSlug}`);

  // Sign + save BEFORE consuming the one-shot setup token: render the stamped
  // agreement PDF and store it privately. On failure we return early with the
  // token still unspent so the affiliate can retry signing. No stored contract
  // means the flow never reaches the live step.
  const meta = APP_META[appSlug];
  const brandKey = APP_TO_BRAND[appSlug];
  const handleSlug = slugifyHandle(bodyHandle || displayName.split(/\s+/)[0] || "creator");
  const signedAtIso = new Date().toISOString();
  let storagePath: string | null = null;
  if (meta && brandKey) {
    try {
      storagePath = await renderAndStoreAgreement({
        appSlug,
        handleSlug,
        appName: meta.appName,
        displayName,
        contactEmail: (contactEmail ?? payoutEmail) || "-",
        trackingUrl: getTrackingUrl(brandKey, handleSlug),
        commissionPct: meta.commissionPct,
        attributionMonths: meta.attributionMonths,
        signerName: signatureName,
        signedAtIso,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[affiliate/complete] agreement render/store failed", msg);
      return bad(req, "agreement_save_failed", 502);
    }
  }

  let row: { promo_code?: string; handle?: string; id?: string; contact_email?: string; language?: string };
  try {
    row = await sbRpc<{ promo_code?: string; handle?: string; id?: string; contact_email?: string; language?: string }>(app, "complete_influencer_setup", {
      p_token: token,
      p_display_name: displayName,
      p_country: country,
      p_payout_method: payoutMethod,
      p_payout_email: payoutEmail || null,
      p_payout_iban: null,
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
  // Prefer the contact_email that was set at create_influencer_setup time
  // (token mint), fall back to the payout email the user just entered.
  const sendEmail = row.contact_email ?? contactEmail;

  // Auto-mint an internal influencer_codes row from the handle when the
  // onboarding finished without a promo_code. This keeps the App-side
  // referral capture (yarn-stash + moto match on influencer_codes.code)
  // working without surfacing the code anywhere user-facing — the Affiliate
  // only ever sees the tracking link, the code is just an internal slug.
  // Trubel matches on referrals.influencer_handle directly, so it doesn't
  // need this. The other apps (wavelength, myloo) are skipped until
  // their app-side capture is wired up.
  if (!finalPromo && (appSlug === "yarn-stash" || appSlug === "moto" || appSlug === "kelva" || appSlug === "promillio")) {
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
        // Two shapes in the wild:
        //   - Yarn-Stash returns json: { success, code } or { error, detail }
        //   - Moto returns the influencer_codes row directly (success-by-presence)
        // Both expose `.code` on success; the json shape adds `.error` on failure.
        const result = await sbRpc<{
          success?: boolean;
          code?: string;
          id?: string;
          error?: string;
          detail?: string;
        }>(app, "admin_create_influencer_code", {
          p_code: autoCode,
          p_display_name: displayName,
          p_handle: handle,
          p_commission_pct: commissionDecimal,
        });
        if (result?.error === "CODE_EXISTS") {
          // Idempotent: the row is already there from a prior run, reuse it.
          finalPromo = autoCode;
        } else if (result?.error) {
          console.warn("[affiliate/complete] auto-mint returned error", result.error, result.detail);
        } else if (result?.code) {
          finalPromo = result.code;
        } else {
          // Shape we didn't anticipate — assume failure, log it.
          console.warn("[affiliate/complete] auto-mint unexpected response shape", JSON.stringify(result).slice(0, 200));
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
    signerName: signatureName,
    storagePath,
    ip,
    userAgent: ua,
  });

  if (sendEmail && meta && brandKey) {
    // Tracking URL uses the per-influencer code as path segment (the
    // /i/<host>/<code> route validates against the app's influencer_codes
    // table for yarn-stash + moto; trubel matches on the handle directly).
    // It's an internal identifier, the Affiliate never sees it as a "promo
    // code" anymore in mail/PDF/UI, it's just part of the link. Built via
    // the shared getTrackingUrl() so the UI Step 4 panel always matches
    // what arrives in the inbox.
    const trackingSlug = finalPromo || handle || row.id || "creator";
    const trackingUrl = getTrackingUrl(brandKey, trackingSlug);
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
      signed_at: agreement?.signed_at ?? signedAtIso,
      language,
    }).catch(() => { /* already logged */ });
  }

  // Admin notification: log a setup_completed event and let the flusher
  // decide whether to send a digest mail (batched per admin_settings).
  // Fire-and-forget — the influencer's completion response must not block
  // on Brevo / Supabase availability.
  void (async () => {
    try {
      const settings = await getAdminSettings({ revalidate: 30 });
      if (!settings.notification_trigger_complete) return;
      await logNotifEvent({
        event_type: "setup_completed",
        app_slug: appSlug,
        handle,
        inquiry_id: null,
        payload: {
          display_name: displayName,
          country,
          promo_code: finalPromo || null,
        },
      });
      await flushNotifsIfBatchReady();
    } catch (e) {
      console.warn("[affiliate/complete] notif log/flush threw", e);
    }
  })();

  return NextResponse.json({ ok: true, promo_code: finalPromo || null, handle: row.handle ?? null }, {
    headers: corsHeaders(req.headers.get("origin")),
  });
}
