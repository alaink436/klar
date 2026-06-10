// POST /admin/outreach/scrape-settings
// Persists the Scrape-Einstellungen tab (singleton klar_scrape_settings row).
// Auth via klar_admin cookie (mirror of the other admin/outreach/* routes).
// instagram_backend is forced to 'apify' server-side regardless of the form
// (defense-in-depth: IG residential is blocked, the radio is also disabled).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { verifyDeviceCookie } from "../../../../lib/deviceCookie";
import {
  upsertScrapeSettings,
  type ScrapeBackend,
  type ProxyProvider,
  type WaveBackend,
} from "../../../../lib/scrapeSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=outreach&tab=scrape&msg=${encodeURIComponent(msg.slice(0, 300))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return back(req, "Server misconfigured: admin secrets missing");
  // Full gate: HMAC device cookie + admin session (mirror of the page.tsx GET
  // gate). Verifying the device cookie first closes the CSRF gap of an
  // admin-cookie-only POST changing live scrape behavior.
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form");
  }

  const tiktok_backend: ScrapeBackend =
    String(form.get("tiktok_backend") ?? "apify") === "selfhost" ? "selfhost" : "apify";

  // The production scrape path: 'evomi' routes "Welle starten" through the in-app
  // queue+cron (TikTok via Evomi, IG via Apify); 'n8n' keeps the legacy webhook.
  const wave_backend: WaveBackend =
    String(form.get("wave_backend") ?? "n8n") === "evomi" ? "evomi" : "n8n";

  const proxyRaw = String(form.get("proxy_provider") ?? "none");
  const proxy_provider: ProxyProvider =
    proxyRaw === "iproyal" ? "iproyal" : proxyRaw === "dataimpulse" ? "dataimpulse" : "none";

  const selfhost_enabled = form.get("selfhost_enabled") != null;
  const max_profiles_per_wave = Number(form.get("max_profiles_per_wave") ?? 30);

  try {
    const s = await upsertScrapeSettings({
      tiktok_backend,
      instagram_backend: "apify", // invariant — IG self-host never honoured
      wave_backend,
      max_profiles_per_wave,
      selfhost_enabled,
      proxy_provider,
      updated_by: "admin",
    });
    return back(
      req,
      `Scrape-Einstellungen gespeichert: Backend=${s.wave_backend}, TikTok=${s.tiktok_backend}, max ${s.max_profiles_per_wave}/Welle`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Speichern fehlgeschlagen: ${msg.slice(0, 200)}`);
  }
}
