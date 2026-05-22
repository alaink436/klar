// POST /admin/outreach/add — neuen Outreach-Target inserten.
// Admin-Auth via klar_admin Cookie (gleich wie /admin/dispatch).
// Form-POST: handle, platform, display_name, profile_url, niche,
// follower_estimate, language, for_apps (comma-sep), priority, notes.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { createOutreachTarget } from "../../../../lib/outreachStore";
import type { OutreachPlatform } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const PRIORITY_MIN = 1;
const PRIORITY_MAX = 5;
const FOLLOWERS_MAX = 100_000_000;

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=outreach&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
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

  const rawHandle = String(form.get("handle") ?? "").trim();
  const handle = rawHandle.replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return back(req, "handle ungültig");

  const platform = String(form.get("platform") ?? "").trim() as OutreachPlatform;
  if (platform !== "tiktok" && platform !== "instagram") {
    return back(req, "platform muss tiktok oder instagram sein");
  }

  const displayName = String(form.get("display_name") ?? "").trim() || null;
  const profileUrl = String(form.get("profile_url") ?? "").trim() || null;
  if (profileUrl && profileUrl.length > 500) return back(req, "profile_url zu lang");

  const niche = String(form.get("niche") ?? "").trim() || null;
  const language = String(form.get("language") ?? "de").trim().toLowerCase();
  if (!["de", "en", "fr", "es", "it"].includes(language)) {
    return back(req, "language ungültig");
  }

  const rawFollowers = String(form.get("follower_estimate") ?? "").trim();
  let followerEstimate: number | null = null;
  if (rawFollowers) {
    const n = Number(rawFollowers);
    if (!isFinite(n) || n < 0 || n > FOLLOWERS_MAX) {
      return back(req, "follower_estimate ungültig");
    }
    followerEstimate = Math.round(n);
  }

  const rawApps = String(form.get("for_apps") ?? "").trim();
  const forApps = rawApps
    ? rawApps.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0)
    : [];

  const rawPriority = String(form.get("priority") ?? "3").trim();
  const priority = Math.round(Number(rawPriority));
  if (!isFinite(priority) || priority < PRIORITY_MIN || priority > PRIORITY_MAX) {
    return back(req, "priority muss 1-5 sein");
  }

  const notes = String(form.get("notes") ?? "").trim() || null;

  try {
    const row = await createOutreachTarget({
      handle,
      platform,
      display_name: displayName,
      profile_url: profileUrl,
      follower_estimate: followerEstimate,
      niche,
      language,
      for_apps: forApps,
      priority,
      notes,
    });
    return back(req, `Hinzugefügt: @${row.handle} (${row.platform})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Eindeutigkeit (platform, handle) → 23505 = "already exists"
    if (msg.includes("23505") || /duplicate|unique/.test(msg)) {
      return back(req, `@${handle} auf ${platform} ist schon im Tracker`);
    }
    return back(req, `Insert fehlgeschlagen: ${msg.slice(0, 120)}`);
  }
}
