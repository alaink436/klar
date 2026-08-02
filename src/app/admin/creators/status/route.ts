// POST /admin/creators/status — Status eines Creators ändern.
// Aktivieren / Pausieren / Sperren. "Sperren" ist der Kill-Switch aus dem PRD:
// wer entgleist (erfundene Zahlen, Spam, Policy-Verstoß) wird sofort
// abgeschaltet. Der Tracking-Link selbst bleibt bestehen — schon verdiente
// Provision gehört dem Creator, gesperrt heißt "postet nicht mehr für uns".
//
// Auth: HMAC-Device-Cookie + Admin-Session (gleiche Härtung wie
// /admin/outreach/scrape-settings — ein Admin-Cookie allein wäre CSRF-offen).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { verifyDeviceCookie } from "../../../../lib/deviceCookie";
import { setCreatorStatus, CREATOR_STATUSES, type CreatorStatus } from "../../../../lib/creatorStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const id = String(form.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return back(req, "id ungültig");

  const raw = String(form.get("status") ?? "").trim();
  if (!CREATOR_STATUSES.includes(raw as CreatorStatus)) return back(req, "Status ungültig");
  const status = raw as CreatorStatus;

  const ok = await setCreatorStatus(id, status);
  return back(
    req,
    ok ? `Creator auf „${status}" gesetzt.` : "Konnte den Status nicht ändern (Migration 0014 angewendet?).",
  );
}
