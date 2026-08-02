// POST /admin/creators/add — Creator von Hand anlegen.
//
// Das ist der Phase-0-Pfad aus dem PRD: bevor das Self-Serve-Portal existiert,
// werden die ersten Creator hier eingetragen und der Tracking-Link von Hand aus
// /admin/affiliate-create geholt. Sobald der Signup selbst läuft, schreibt der
// dieselbe Tabelle — diese Route bleibt für Nachträge und Korrekturen.
//
// Auth: HMAC-Device-Cookie + Admin-Session (wie /admin/creators/status).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { verifyDeviceCookie } from "../../../../lib/deviceCookie";
import { insertCreator, type CreatorPlatform } from "../../../../lib/creatorStore";
import { KLAR_APPS } from "../../../../lib/klarApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORMS: CreatorPlatform[] = ["tiktok", "instagram", "youtube"];

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin/creators?msg=${encodeURIComponent(msg.slice(0, 300))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return back(req, "Server misconfigured: admin secrets missing");
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

  const handle = String(form.get("handle") ?? "").trim().replace(/^@+/, "");
  if (!handle) return back(req, "Handle fehlt");

  const app = String(form.get("app") ?? "").trim();
  if (!KLAR_APPS.some((a) => a.slug === app)) return back(req, "App ungültig");

  const rawPlatform = String(form.get("platform") ?? "tiktok").trim();
  const platform: CreatorPlatform = PLATFORMS.includes(rawPlatform as CreatorPlatform)
    ? (rawPlatform as CreatorPlatform)
    : "tiktok";

  // Follower sind optional und kommen aus einem Textfeld — alles Unparsbare
  // wird null statt 0, damit "unbekannt" nicht wie "hat keine" aussieht.
  const followersRaw = String(form.get("follower_estimate") ?? "").replace(/[^\d]/g, "");
  const follower_estimate = followersRaw ? Number(followersRaw) : null;

  const trackingUrl = String(form.get("tracking_url") ?? "").trim();
  const trackingHandle = String(form.get("tracking_handle") ?? "").trim().replace(/^@+/, "");

  const row = await insertCreator({
    handle,
    app,
    platform,
    display_name: String(form.get("display_name") ?? "").trim() || null,
    email: String(form.get("email") ?? "").trim() || null,
    language: String(form.get("language") ?? "de").trim().slice(0, 5) || "de",
    follower_estimate: Number.isFinite(follower_estimate as number) ? follower_estimate : null,
    source: String(form.get("source") ?? "").trim() || null,
    tracking_handle: trackingHandle || null,
    tracking_url: trackingUrl || null,
    notes: String(form.get("notes") ?? "").trim() || null,
    // Ein Creator mit Tracking-Link ist sofort einsatzbereit; ohne Link bleibt
    // er "beworben", weil er ohne Link nichts verdienen könnte.
    status: trackingUrl ? "active" : "applied",
  });

  if (!row) {
    return back(
      req,
      `@${handle} konnte nicht angelegt werden — schon für diese App erfasst, oder Migration 0014 fehlt.`,
    );
  }
  return back(req, `@${handle} angelegt (${row.status === "active" ? "aktiv" : "beworben"}).`);
}
