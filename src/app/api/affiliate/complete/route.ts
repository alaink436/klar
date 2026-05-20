// Public-facing completion endpoint for the Klar-hosted onboarding pages
// (Yarn-Stash + ThrottleUp fallback). The sister-repo apps (Trubel/MyLoo/
// Wavelength/Kelva) hit `complete_influencer_setup` directly with their own
// anon-key from the browser — they don't need this proxy.
//
// Why a proxy here: Klar doesn't ship the Yarn-Stash / ThrottleUp anon-key
// in its bundle (would expose the wrong tenant's project), so the browser
// posts to Klar, and Klar's server forwards the call to the right app's
// Supabase using the service-role key from KLAR_ADMIN_APPS.

import { NextResponse, type NextRequest } from "next/server";
import { getApp, sbRpc } from "@/lib/adminApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const COUNTRY_RE = /^[A-Z]{2,8}$/;
const PAYOUT_METHODS = new Set(["wise", "paypal", "sepa", "manual"]);

function bad(message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status });
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

  const app = getApp(appSlug);
  if (!app) return bad(`unknown app: ${appSlug}`);

  try {
    const row = await sbRpc<{ promo_code?: string; handle?: string }>(app, "complete_influencer_setup", {
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
    return NextResponse.json({ ok: true, promo_code: row.promo_code ?? null, handle: row.handle ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return bad(msg, 502);
  }
}
