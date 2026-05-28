// POST /admin/affiliate-create — Self-serve affiliate anlegen für DM-Outreach.
//
// Use-case: Alain fragt einen Influencer per DM an (kein öffentliches
// Inquiry-Formular davor). Diese Route mintet direkt ein Setup-Token in der
// App-Supabase (wie /admin/approve, nur ohne klar_inquiries-Zeile) und gibt
// BEIDE Links zurück: den Onboarding-Link (Payout-Setup, 7d gültig) und den
// fertigen Tracking-Link zum Teilen.
//
// Email ist optional: ist eine angegeben, geht die Onboarding-Mail automatisch
// raus; ist sie leer, wird nur der Link erzeugt (zum Reinpasten in die DM).
//
// Shape B (yarn-stash, moto, kelva) braucht eine influencer_codes-Zeile, damit
// der Tracking-Link sofort funktioniert — die wird hier gleich mit-gemintet
// (deterministischer Code aus dem Handle, intern, nie user-facing). Shape A
// (trubel, wavelength, myloo) trackt direkt über referrals.influencer_handle.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import {
  getApp,
  createInfluencerSetup,
  setupLandingUrl,
  sbRpc,
  type AdminApp,
} from "@/lib/adminApps";
import { getTrackingUrl, type BrandKey } from "@/app/affiliate/_shared/brands";
import { sendOnboardingMail } from "@/lib/affiliateApprove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_RE = /^(de|en|fr|es|it|nl|pt|pl)$/;

// App-Slug → Brand-Key (siehe api/affiliate/complete). Zwei historische
// Mismatches: yarn-stash→yarnstash, moto→throttleup.
const APP_TO_BRAND: Record<string, BrandKey> = {
  "yarn-stash": "yarnstash",
  moto: "throttleup",
  wavelength: "wavelength",
  kelva: "kelva",
  trubel: "trubel",
  myloo: "myloo",
};

// Apps deren Tracking über eine influencer_codes-Zeile läuft (Shape B). Muss
// mit der Auto-Mint-Bedingung in api/affiliate/complete übereinstimmen.
const SHAPE_B_APPS = new Set(["yarn-stash", "moto", "kelva"]);

function back(req: NextRequest, msg: string, appSlug?: string): Response {
  const view = appSlug ? `?view=${encodeURIComponent(appSlug)}` : "?view=overview";
  return NextResponse.redirect(
    new URL(`/admin${view}&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
}

// Deterministischer interner Code aus dem Handle (gleiche Ableitung wie der
// Auto-Mint in api/affiliate/complete, damit beide idempotent dieselbe Zeile
// treffen). Gibt "" zurück wenn < 2 verwertbare Zeichen übrig bleiben.
function deriveCode(handle: string): string {
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
      console.warn("[affiliate-create] mint returned error", result.error, result.detail);
      return null;
    }
    if (result?.code) return result.code;
    console.warn("[affiliate-create] mint unexpected shape", JSON.stringify(result).slice(0, 200));
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) return args.code;
    console.warn("[affiliate-create] mint threw", msg);
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

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form");
  }

  const appSlug = String(form.get("app") ?? "").trim();
  const handle = String(form.get("handle") ?? "").trim().replace(/^@/, "").toLowerCase();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const displayName = String(form.get("display_name") ?? "").trim();
  const language = String(form.get("language") ?? "de").trim().toLowerCase();
  const sharePct = Math.round(Number(form.get("share_pct") ?? 50));
  const shareMonths = Math.round(Number(form.get("share_months") ?? 24));

  if (!appSlug) return back(req, "app fehlt");
  if (!HANDLE_RE.test(handle)) return back(req, "handle ungültig", appSlug);
  if (email && !EMAIL_RE.test(email)) return back(req, "email ungültig", appSlug);
  if (!LANG_RE.test(language)) return back(req, "sprache ungültig", appSlug);
  if (!isFinite(sharePct) || sharePct <= 0 || sharePct > 100) return back(req, "share_pct außerhalb 1..100", appSlug);
  if (!isFinite(shareMonths) || shareMonths <= 0 || shareMonths > 60) return back(req, "share_months außerhalb 1..60", appSlug);

  const app = getApp(appSlug);
  if (!app) return back(req, `unbekannte App: ${appSlug}`, appSlug);

  // 1) Setup-Token minten (legt influencers-Zeile als 'pending' an bzw. upsert).
  let setup;
  try {
    setup = await createInfluencerSetup(app, {
      email, // leer => contact_email NULL (RPC: nullif(...,''))
      handle,
      displayName: displayName || handle,
      language,
      appSlug: app.slug,
      sharePct,
      shareMonths,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Anlegen fehlgeschlagen: ${msg}`, appSlug);
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
        displayName: displayName || handle,
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

  // 3) Optional: Onboarding-Mail. Nur wenn eine Email angegeben wurde.
  let mailNote = " · kein Mail (Link manuell teilen)";
  if (email) {
    const mail = await sendOnboardingMail({ to: email, appSlug: app.slug, handle, landingUrl: onboardingUrl, language });
    mailNote = mail.sent ? ` · Mail an ${email} gesendet` : ` · Mail NICHT gesendet (${mail.error ?? "?"})`;
  }

  const trackingNote = trackingUrl ? ` · Tracking: ${trackingUrl}` : "";
  return back(req, `@${handle} angelegt. Onboarding: ${onboardingUrl}${trackingNote}${mailNote}`, appSlug);
}
