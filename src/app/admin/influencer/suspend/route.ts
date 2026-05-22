// POST /admin/influencer/suspend — flippt influencers.status für eine spezifische
// App + handle. Plus mirror auf influencer_codes.status für Shape-B-Apps.
//
// `setInfluencerStatus` ist die Single-Source-of-Truth in adminApps.ts.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { getApp, setInfluencerStatus } from "../../../../lib/adminApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const ALLOWED_STATUSES = new Set(["active", "suspended", "banned", "paused"] as const);
type StatusVal = "active" | "suspended" | "banned" | "paused";

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
  const statusRaw = String(form.get("status") ?? "").trim() as StatusVal;

  if (!appSlug) return back(req, "app fehlt");
  if (!HANDLE_RE.test(handle)) return back(req, "handle ungültig");
  if (!ALLOWED_STATUSES.has(statusRaw)) return back(req, "status ungültig", appSlug);

  const app = getApp(appSlug);
  if (!app) return back(req, `unknown app: ${appSlug}`);

  const result = await setInfluencerStatus(app, handle, statusRaw);
  if (!result.ok) {
    return back(req, `suspend failed: ${result.error ?? "unknown"}`.slice(0, 200), appSlug);
  }
  return back(req, `@${handle} → ${statusRaw}`, appSlug);
}
