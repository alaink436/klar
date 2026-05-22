// POST handler for /admin/settings.
//
// The settings page renders three independent forms (global, notif, invite —
// invite has its own route at /admin/invite). Each posts a hidden
// `section=<name>` so the server reads only the fields belonging to that
// section. Validation is strict — out-of-range values bounce back to the
// settings page with ?err=… and no DB write happens.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { updateAdminSettings } from "@/lib/adminSettings";
import { verifyDeviceCookie } from "@/lib/deviceCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_BATCH_SIZES = new Set([1, 5, 10, 25, 50, 100]);

function redirectWith(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/settings", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest): Promise<Response> {
  // Auth — same shape as /admin/approve. Misconfigured env returns 503 so
  // the route never silently writes without proper guards.
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
    return redirectWith(req, { err: "bad form" });
  }

  const section = String(form.get("section") ?? "").trim();

  if (section === "global") {
    // Checkboxes only post when checked → presence-check, not value-check.
    const patch = {
      shader_enabled: form.get("shader_enabled") != null,
      auto_accept_affiliates: form.get("auto_accept_affiliates") != null,
    };
    try {
      await updateAdminSettings(patch, device.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return redirectWith(req, { err: msg });
    }
    return redirectWith(req, { msg: "Globale Einstellungen gespeichert." });
  }

  if (section === "notif") {
    const batchSize = Number(form.get("notification_batch_size") ?? 1);
    if (!Number.isFinite(batchSize) || !ALLOWED_BATCH_SIZES.has(batchSize)) {
      return redirectWith(req, { err: "Batch-Grösse ungültig." });
    }
    const recipient = String(form.get("notification_recipient_email") ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(recipient)) {
      return redirectWith(req, { err: "Empfänger-Email ungültig." });
    }
    const patch = {
      notification_trigger_inquiry: form.get("notification_trigger_inquiry") != null,
      notification_trigger_complete: form.get("notification_trigger_complete") != null,
      notification_batch_size: batchSize,
      notification_recipient_email: recipient,
    };
    try {
      await updateAdminSettings(patch, device.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return redirectWith(req, { err: msg });
    }
    return redirectWith(req, { msg: "Benachrichtigungen gespeichert." });
  }

  return redirectWith(req, { err: `unknown section: ${section || "(empty)"}` });
}
