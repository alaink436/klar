// GET /admin/templates/get?app=<slug>&language=<lang>
// Returns the per-app outreach template (hashtags + mail1/2) as JSON.
// Used by the Welle-Starter form's JS to pre-fill defaults when the
// admin selects exactly one app.
// Admin-cookie-auth like the rest of /admin.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { getAppTemplate } from "../../../../lib/outreachStore";
import { KLAR_APPS } from "../../../../lib/klarApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_LANGS = new Set(["de", "en", "fr", "es", "it"]);

export async function GET(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY || !ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const appSlug = (url.searchParams.get("app") ?? "").toLowerCase();
  const language = (url.searchParams.get("language") ?? "de").toLowerCase();
  if (!KLAR_APPS.some((a) => a.slug === appSlug)) {
    return NextResponse.json({ error: "unknown app" }, { status: 400 });
  }
  if (!ALLOWED_LANGS.has(language)) {
    return NextResponse.json({ error: "unknown language" }, { status: 400 });
  }
  const tpl = await getAppTemplate(appSlug, language);
  return NextResponse.json(tpl ?? null);
}
