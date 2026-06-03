// POST /admin/outreach/accept — macht aus einem Outreach-Reply explizit einen
// Affiliate. Das ist der EINZIGE Pfad, über den der Onboarding-Link rausgeht.
//
// Ablauf: Setup-Token in der gewählten App minten (+ Shape-B influencer_codes
// + Tracking-URL) via provisionAffiliate, optional die Onboarding-Mail
// schicken, dann das Outreach-Target auf `converted` setzen und die
// Onboarding-Artefakte mitstempeln (markConverted).
//
// Bewusst getrennt von /admin/outreach/reply: eine Antwort allein nimmt
// niemanden an. Erst dieser Klick.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { getApp } from "@/lib/adminApps";
import { provisionAffiliate } from "@/lib/affiliateProvision";
import { markConverted } from "@/lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_RE = /^(de|en|fr|es|it|nl|pt|pl)$/;

function back(req: NextRequest, msg: string): Response {
  let view = "?view=outreach";
  try {
    const ref = req.headers.get("referer");
    if (ref) {
      const v = new URL(ref).searchParams.get("view");
      if (v) view = `?view=${encodeURIComponent(v)}`;
    }
  } catch {
    /* default view */
  }
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

  const id = String(form.get("id") ?? "").trim();
  const appSlug = String(form.get("app") ?? "").trim();
  const handle = String(form.get("handle") ?? "").trim().replace(/^@/, "").toLowerCase();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const displayName = String(form.get("display_name") ?? "").trim();
  const language = String(form.get("language") ?? "de").trim().toLowerCase();
  const sharePct = Math.round(Number(form.get("share_pct") ?? 50));
  const shareMonths = Math.round(Number(form.get("share_months") ?? 24));
  const sendMail = String(form.get("send_mail") ?? "") === "on";

  if (!UUID_RE.test(id)) return back(req, "id ungültig");
  if (!appSlug) return back(req, "app fehlt");
  if (!HANDLE_RE.test(handle)) return back(req, "handle ungültig");
  if (email && !EMAIL_RE.test(email)) return back(req, "email ungültig");
  if (!LANG_RE.test(language)) return back(req, "sprache ungültig");
  if (!isFinite(sharePct) || sharePct <= 0 || sharePct > 100) return back(req, "share_pct außerhalb 1..100");
  if (!isFinite(shareMonths) || shareMonths <= 0 || shareMonths > 60) return back(req, "share_months außerhalb 1..60");

  const app = getApp(appSlug);
  if (!app) return back(req, `unbekannte App: ${appSlug}`);

  const r = await provisionAffiliate({
    app,
    handle,
    email,
    displayName,
    language,
    sharePct,
    shareMonths,
    sendMail,
  });
  if (!r.ok) return back(req, `Annehmen fehlgeschlagen: ${r.error ?? "?"}`);

  // Target auf converted setzen + Onboarding-Artefakte stempeln.
  try {
    await markConverted(id, {
      appSlug,
      handle,
      onboardingToken: r.token ?? null,
      onboardingLink: r.onboardingUrl ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Affiliate ist angelegt, nur das Status-Update klemmt — Link trotzdem zeigen.
    return back(req, `Affiliate angelegt, Status-Update klemmt (${msg}). Onboarding: ${r.onboardingUrl}`);
  }

  const mailNote = email
    ? sendMail
      ? r.mailSent
        ? ` · Mail an ${email} gesendet`
        : ` · Mail NICHT gesendet (${r.mailError ?? "?"})`
      : " · ohne Mail (Link manuell teilen)"
    : " · keine Email hinterlegt (Link manuell teilen)";
  const trackingNote = r.trackingUrl ? ` · Tracking: ${r.trackingUrl}` : "";
  return back(req, `@${handle} als Affiliate (${appSlug}) angenommen. Onboarding: ${r.onboardingUrl}${trackingNote}${mailNote}`);
}
