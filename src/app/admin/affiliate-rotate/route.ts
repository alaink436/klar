// POST /admin/affiliate-rotate — Onboarding-Setup-Token neu erzeugen.
//
// Use-case: der alte Onboarding-Link ist abgelaufen oder geleakt. Wir rufen
// create_influencer_setup erneut auf (ON CONFLICT (handle) regeneriert das
// setup_token + 7d-TTL). Wichtig: die RPC überschreibt share_pct/share_months/
// language mit den übergebenen Werten, darum lesen wir die bestehende Zeile
// vorher aus und reichen die aktuellen Werte wieder ein — sonst clobbern wir
// die Konditionen des Affiliates.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { getApp, sbGet, createInfluencerSetup, setupLandingUrl } from "@/lib/adminApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;

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

  if (!appSlug) return back(req, "app fehlt");
  if (!HANDLE_RE.test(handle)) return back(req, "handle ungültig", appSlug);

  const app = getApp(appSlug);
  if (!app) return back(req, `unbekannte App: ${appSlug}`, appSlug);

  // Bestehende Konditionen lesen, damit der Upsert sie nicht überschreibt.
  const rows = await sbGet(
    app,
    `influencers?handle=eq.${encodeURIComponent(handle)}&select=share_pct,share_months,language,contact_email,display_name&limit=1`,
  );
  const cur = rows[0];
  if (!cur) return back(req, `@${handle} nicht gefunden in ${appSlug}`, appSlug);

  let setup;
  try {
    setup = await createInfluencerSetup(app, {
      email: cur.contact_email ?? "",
      handle,
      displayName: cur.display_name ?? handle,
      language: cur.language ?? "de",
      appSlug: app.slug,
      sharePct: cur.share_pct ?? 50,
      shareMonths: cur.share_months ?? 24,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Rotate fehlgeschlagen: ${msg}`, appSlug);
  }

  const onboardingUrl = setupLandingUrl(app.slug, setup.setup_token);
  return back(req, `@${handle} neuer Onboarding-Link (7d): ${onboardingUrl}`, appSlug);
}
