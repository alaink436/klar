// POST /admin/influencer/delete — Hard delete eines Influencers in der App-Supabase.
// Schlägt fehl wenn referral_revenue_events / referrals / payout_items existieren
// (Foreign-Key-Constraint), und das ist gewollt: dann lieber `setInfluencerStatus('banned')`.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { getApp, hardDeleteInfluencer } from "../../../../lib/adminApps";

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
  if (!HANDLE_RE.test(handle)) return back(req, "handle ungültig");

  const app = getApp(appSlug);
  if (!app) return back(req, `unknown app: ${appSlug}`);

  const result = await hardDeleteInfluencer(app, handle);
  if (!result.ok) {
    return back(
      req,
      `Hard delete fehlgeschlagen — dieser Influencer hat schon referrals/events. Nutze stattdessen Suspend. (${result.error ?? "FK"})`.slice(0, 380),
      appSlug,
    );
  }
  return back(req, `@${handle} hart gelöscht aus ${appSlug}`, appSlug);
}
