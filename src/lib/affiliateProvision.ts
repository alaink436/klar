// SERVER ONLY. Geteilter Affiliate-Provisioning-Kern.
//
// Extrahiert aus /admin/affiliate-create, damit /admin/outreach/accept exakt
// denselben Mint-Flow wiederverwendet: Setup-Token (createInfluencerSetup) +
// optional Shape-B influencer_codes-Zeile + Tracking-URL + optionale
// Onboarding-Mail. Eine Quelle = DM-Create-Pfad und Outreach-Accept-Pfad
// können nie auseinanderdriften.

import {
  createInfluencerSetup,
  setupLandingUrl,
  sbRpc,
  type AdminApp,
} from "@/lib/adminApps";
import { getTrackingUrl, type BrandKey } from "@/app/affiliate/_shared/brands";
import { sendOnboardingMail } from "@/lib/affiliateApprove";

// App-Slug → Brand-Key. Zwei historische Mismatches: yarn-stash→yarnstash,
// moto→throttleup.
export const APP_TO_BRAND: Record<string, BrandKey> = {
  "yarn-stash": "yarnstash",
  moto: "throttleup",
  wavelength: "wavelength",
  kelva: "kelva",
  trubel: "trubel",
  myloo: "myloo",
};

// Apps deren Tracking über eine influencer_codes-Zeile läuft (Shape B). Muss
// mit der Auto-Mint-Bedingung in api/affiliate/complete übereinstimmen.
export const SHAPE_B_APPS = new Set(["yarn-stash", "moto", "kelva"]);

// Deterministischer interner Code aus dem Handle (gleiche Ableitung wie der
// Auto-Mint in api/affiliate/complete, damit beide idempotent dieselbe Zeile
// treffen). Gibt "" zurück wenn < 2 verwertbare Zeichen übrig bleiben.
export function deriveCode(handle: string): string {
  const c = handle.toUpperCase().replace(/[^A-Z0-9_.-]/g, "").slice(0, 32);
  return c.length >= 2 ? c : "";
}

// Mintet (idempotent) die influencer_codes-Zeile und gibt den Code zurück, der
// als Tracking-Slug taugt. Best-effort: bei Fehlschlag null, der Aufrufer
// fällt dann auf den Handle zurück.
async function mintShapeBCode(
  app: AdminApp,
  args: { code: string; displayName: string; handle: string; commissionDecimal: number },
): Promise<string | null> {
  try {
    const result = await sbRpc<{ success?: boolean; code?: string; error?: string; detail?: string }>(
      app,
      "admin_create_influencer_code",
      {
        p_code: args.code,
        p_display_name: args.displayName,
        p_handle: args.handle,
        p_commission_pct: args.commissionDecimal,
      },
    );
    if (result?.error === "CODE_EXISTS") return args.code; // idempotent reuse
    if (result?.error) {
      console.warn("[provision] mint returned error", result.error, result.detail);
      return null;
    }
    if (result?.code) return result.code;
    console.warn("[provision] mint unexpected shape", JSON.stringify(result).slice(0, 200));
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) return args.code;
    console.warn("[provision] mint threw", msg);
    return null;
  }
}

// Schreibt influencers.promo_code, damit das Admin-UI den Code zeigt und der
// Onboarding-Complete-Flow nicht erneut mintet. Best-effort.
async function setPromoCode(app: AdminApp, handle: string, code: string): Promise<void> {
  await fetch(
    `${app.supabaseUrl}/rest/v1/influencers?handle=eq.${encodeURIComponent(handle)}`,
    {
      method: "PATCH",
      headers: {
        apikey: app.serviceKey,
        Authorization: `Bearer ${app.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ promo_code: code }),
    },
  ).catch(() => undefined);
}

export interface ProvisionArgs {
  app: AdminApp;
  handle: string;
  email?: string;
  displayName?: string;
  language?: string;
  sharePct?: number;
  shareMonths?: number;
  sendMail?: boolean; // nur wenn true UND email gesetzt geht die Onboarding-Mail raus
}

export interface ProvisionResult {
  ok: boolean;
  error?: string;
  token?: string;
  onboardingUrl?: string;
  trackingUrl?: string;
  mailSent?: boolean;
  mailError?: string | null;
}

/**
 * Legt einen Affiliate an: Setup-Token in der App-Supabase minten, bei Shape-B
 * die influencer_codes-Zeile + promo_code setzen, Tracking-URL bauen und
 * optional die Onboarding-Mail schicken. Wirft nie — gibt ok=false + error.
 */
export async function provisionAffiliate(args: ProvisionArgs): Promise<ProvisionResult> {
  const { app } = args;
  const handle = args.handle.trim().replace(/^@/, "").toLowerCase();
  const email = (args.email ?? "").trim().toLowerCase();
  const displayName = (args.displayName ?? "").trim() || handle;
  const language = (args.language ?? "de").trim().toLowerCase();
  const sharePct = Math.round(args.sharePct ?? 50);
  const shareMonths = Math.round(args.shareMonths ?? 24);

  // 1) Setup-Token minten (legt influencers-Zeile als 'pending' an bzw. upsert).
  let setup;
  try {
    setup = await createInfluencerSetup(app, {
      email, // leer => contact_email NULL (RPC: nullif(...,''))
      handle,
      displayName,
      language,
      appSlug: app.slug,
      sharePct,
      shareMonths,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `create_influencer_setup failed: ${msg}` };
  }

  const onboardingUrl = setupLandingUrl(app.slug, setup.setup_token);

  // 2) Tracking-Slug bestimmen. Shape B braucht eine influencer_codes-Zeile,
  //    sonst greift /i/<host>/<code> ins Leere.
  const brand = APP_TO_BRAND[app.slug];
  let trackingSlug = handle;
  if (SHAPE_B_APPS.has(app.slug)) {
    const code = deriveCode(handle);
    if (code) {
      const minted = await mintShapeBCode(app, {
        code,
        displayName,
        handle,
        commissionDecimal: sharePct / 100,
      });
      if (minted) {
        trackingSlug = minted;
        await setPromoCode(app, handle, minted);
      }
    }
  }
  const trackingUrl = brand ? getTrackingUrl(brand, trackingSlug) : "";

  // 3) Optional: Onboarding-Mail. Nur wenn gewünscht UND eine Email da ist.
  let mailSent: boolean | undefined;
  let mailError: string | null | undefined;
  if (args.sendMail && email) {
    const mail = await sendOnboardingMail({
      to: email,
      appSlug: app.slug,
      handle,
      landingUrl: onboardingUrl,
      language,
    });
    mailSent = mail.sent;
    mailError = mail.error ?? null;
  }

  return { ok: true, token: setup.setup_token, onboardingUrl, trackingUrl, mailSent, mailError };
}
