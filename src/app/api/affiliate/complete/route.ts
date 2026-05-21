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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function bad(message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function logAgreement(args: {
  appSlug: string;
  influencerId: string;
  displayName: string;
  contactEmail: string | null;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ signed_at: string } | null> {
  const url = process.env.KLAR_INBOX_SUPABASE_URL;
  const key = process.env.KLAR_INBOX_SERVICE_KEY;
  if (!url || !key) {
    console.warn("[affiliate/complete] KLAR_INBOX_* env missing, agreement not logged");
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
  promo_code: string;
  tracking_url: string;
  commission_pct: number;
  attribution_months: number;
  assets_drive_url: string | null;
  agreement_version: string;
  signed_at: string;
}): Promise<void> {
  const url = process.env.KLAR_INBOX_SUPABASE_URL;
  const adminKey = process.env.KLAR_AGREEMENT_ADMIN_KEY;
  if (!url || !adminKey) {
    console.warn("[affiliate/complete] confirmation-email env missing, skip");
    return;
  }
  try {
    const res = await fetch(`${url}/functions/v1/affiliate-confirmation-email`, {
      method: "POST",
      headers: {
        "x-admin-key": adminKey,
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

function clientIp(req: NextRequest): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest): Promise<Response> {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("bad json");
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

  if (!appSlug) return bad("missing app");
  if (token.length < 16) return bad("invalid token");
  if (!displayName) return bad("missing display_name");
  if (!COUNTRY_RE.test(country)) return bad("invalid country");
  if (!PAYOUT_METHODS.has(payoutMethod)) return bad("invalid payout_method");
  if (promoCode && !HANDLE_RE.test(promoCode)) return bad("invalid promo_code");
  if (payoutMethod === "sepa" && !payoutIban) return bad("missing iban");
  if ((payoutMethod === "wise" || payoutMethod === "paypal") && !payoutEmail) {
    return bad("missing payout_email");
  }
  if (!agreementAccepted) return bad("agreement_not_accepted");

  const app = getApp(appSlug);
  if (!app) return bad(`unknown app: ${appSlug}`);

  let row: { promo_code?: string; handle?: string; id?: string; contact_email?: string };
  try {
    row = await sbRpc<{ promo_code?: string; handle?: string; id?: string; contact_email?: string }>(app, "complete_influencer_setup", {
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
    return bad(msg, 502);
  }

  // Best-effort side-effects: agreement log + confirmation email. Failures
  // here are non-blocking, the onboarding itself already succeeded.
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");
  const handle = row.handle ?? displayName.split(/\s+/)[0]?.toLowerCase() ?? "creator";
  const finalPromo = row.promo_code ?? promoCode ?? null;
  const meta = KLAR_DOMAIN_BY_APP[appSlug];
  // Prefer the contact_email that was set at create_influencer_setup time
  // (token mint), fall back to the payout email the user just entered.
  const sendEmail = row.contact_email ?? contactEmail;

  const agreement = await logAgreement({
    appSlug,
    influencerId: row.id ?? "00000000-0000-0000-0000-000000000000",
    displayName,
    contactEmail: sendEmail,
    ip,
    userAgent: ua,
  });

  if (sendEmail && finalPromo && meta) {
    const trackingUrl = `https://getklar.org/i/${meta.host}/${finalPromo}`;
    fireConfirmationEmail({
      app_slug: appSlug,
      app_name: meta.appName,
      handle,
      display_name: displayName,
      contact_email: sendEmail,
      promo_code: finalPromo,
      tracking_url: trackingUrl,
      commission_pct: meta.commissionPct,
      attribution_months: meta.attributionMonths,
      assets_drive_url: assetsDriveUrl,
      agreement_version: AGREEMENT_VERSION,
      signed_at: agreement?.signed_at ?? new Date().toISOString(),
    }).catch(() => { /* already logged */ });
  }

  return NextResponse.json({ ok: true, promo_code: finalPromo, handle: row.handle ?? null });
}
