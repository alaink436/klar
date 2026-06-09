// POST /admin/outreach/scrape-settings
// Persists the Scrape-Einstellungen tab (singleton klar_scrape_settings row).
// Auth via klar_admin cookie (mirror of the other admin/outreach/* routes).
// instagram_backend is forced to 'apify' server-side regardless of the form
// (defense-in-depth: IG residential is blocked, the radio is also disabled).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import {
  upsertScrapeSettings,
  type ScrapeBackend,
  type ProxyProvider,
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
  if (!KEY) return back(req, "Server misconfigured: KLAR_ADMIN_KEY missing");
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

  const proxyRaw = String(form.get("proxy_provider") ?? "none");
  const proxy_provider: ProxyProvider =
    proxyRaw === "iproyal" ? "iproyal" : proxyRaw === "dataimpulse" ? "dataimpulse" : "none";

  const selfhost_enabled = form.get("selfhost_enabled") != null;
  const max_profiles_per_wave = Number(form.get("max_profiles_per_wave") ?? 30);

  try {
    const s = await upsertScrapeSettings({
      tiktok_backend,
      instagram_backend: "apify", // invariant — IG self-host never honoured
      max_profiles_per_wave,
      selfhost_enabled,
      proxy_provider,
      updated_by: "admin",
    });
    return back(
      req,
      `Scrape-Einstellungen gespeichert: TikTok=${s.tiktok_backend}, max ${s.max_profiles_per_wave}/Welle, Proxy=${s.proxy_provider}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Speichern fehlgeschlagen: ${msg.slice(0, 200)}`);
  }
}
