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
// Der eigentliche Mint-Flow (Setup-Token + Shape-B influencer_codes +
// Tracking-URL + Mail) liegt in lib/affiliateProvision, damit /admin/outreach/
// accept exakt dasselbe macht.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { getApp } from "@/lib/adminApps";
import { provisionAffiliate } from "@/lib/affiliateProvision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_RE = /^(de|en|fr|es|it|nl|pt|pl)$/;

function back(req: NextRequest, msg: string, appSlug?: string): Response {
  const view = appSlug ? `?view=${encodeURIComponent(appSlug)}` : "?view=overview";
  return NextResponse.redirect(
    new URL(`/admin${view}&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
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

  const r = await provisionAffiliate({
    app,
    handle,
    email,
    displayName,
    language,
    sharePct,
    shareMonths,
    sendMail: true, // wenn email leer ist, schickt provisionAffiliate eh nichts
  });
  if (!r.ok) return back(req, `Anlegen fehlgeschlagen: ${r.error ?? "?"}`, appSlug);

  const mailNote = email
    ? (r.mailSent ? ` · Mail an ${email} gesendet` : ` · Mail NICHT gesendet (${r.mailError ?? "?"})`)
    : " · kein Mail (Link manuell teilen)";
  const trackingNote = r.trackingUrl ? ` · Tracking: ${r.trackingUrl}` : "";
  return back(req, `@${handle} angelegt. Onboarding: ${r.onboardingUrl}${trackingNote}${mailNote}`, appSlug);
}
