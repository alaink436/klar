// POST handler for /admin/invite.
//
// Generates a single-use invite token in admin_invites. The token's URL
// (https://getklar.org/admin/login?invite=<token>) lets a new device sign
// in without the shared KLAR_ADMIN_KEY — TOTP is still required and must
// be shared OOB by the inviter. The token gets stamped used_at on
// successful first login (handled in /admin/login).

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { createInvite } from "@/lib/adminSettings";
import { verifyDeviceCookie } from "@/lib/deviceCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_TTL = new Set([1, 3, 7, 30]);

function back(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/settings", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) {
    return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  }
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/settings", req.url), 303);
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/settings", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, { err: "bad form" });
  }

  const name = String(form.get("name") ?? "").trim().slice(0, 60) || undefined;
  const emailRaw = String(form.get("email") ?? "").trim().toLowerCase();
  const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : undefined;
  if (emailRaw && !email) {
    return back(req, { err: "Email-Format ungültig." });
  }
  const ttlDays = Number(form.get("ttl_days") ?? 7);
  if (!Number.isFinite(ttlDays) || !ALLOWED_TTL.has(ttlDays)) {
    return back(req, { err: "TTL ungültig." });
  }

  try {
    const inv = await createInvite({
      invitedName: name,
      invitedEmail: email,
      createdByDevice: device.name,
      ttlDays,
    });
    // Pass the freshly-minted token through the flash so the admin sees it
    // (next to the new row in the table). The URL is also stored in the
    // table for later copy.
    return back(req, { msg: `Invite-Link erzeugt — gültig ${ttlDays}d. Token: ${inv.token}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, { err: msg });
  }
}
