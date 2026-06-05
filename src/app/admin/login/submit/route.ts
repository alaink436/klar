// Klar Control login — POST handler. Split out from the old login route.ts so
// /admin/login can be a React page (page.tsx) that embeds the input-otp field.
// Validates admin-key + TOTP (+ device name on new devices, or an invite
// token) and issues the device + session cookies. On failure it redirects back
// to /admin/login?err=… so the page can show the message; on success it 303s to
// /admin. Auth logic is unchanged from the previous implementation.

import { ctEqual, readCookie } from "../../_shared";
import { verifyTOTP } from "../../../../lib/totp";
import {
  signDeviceCookie,
  verifyDeviceCookie,
  deviceCookieHeader,
  newDeviceId,
} from "../../../../lib/deviceCookie";
import { fetchInvite, markInviteUsed } from "../../../../lib/adminSettings";
import { clientIp, rateLimit } from "../../../../lib/apiGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = () => process.env.KLAR_ADMIN_KEY ?? "";
const TOTP_SECRET = () => process.env.KLAR_TOTP_SECRET ?? "";
const DEVICE_SECRET = () => process.env.KLAR_DEVICE_SECRET ?? "";

const SESSION_COOKIE_MAX_AGE = 12 * 60 * 60; // 12h

function sessionCookieHeader(keyValue: string): string {
  return `klar_admin=${encodeURIComponent(keyValue)}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
}
function clearLegacyRootPath(): string {
  return `klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
function clearLegacyDeviceRootPath(): string {
  return `klar_device=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

// Redirect back to the login page with an error message (and the invite token,
// so the invite form keeps rendering). The page reads ?err= and shows it.
function back(err: string, invite?: string, extraHeaders?: HeadersInit): Response {
  const qs = new URLSearchParams();
  if (err) qs.set("err", err);
  if (invite) qs.set("invite", invite);
  const headers = new Headers(extraHeaders);
  headers.set("Location", `/admin/login${qs.toString() ? `?${qs.toString()}` : ""}`);
  return new Response(null, { status: 303, headers });
}

export async function POST(req: Request): Promise<Response> {
  if (!KEY() || !TOTP_SECRET() || !DEVICE_SECRET()) {
    return new Response(null, { status: 303, headers: { Location: "/admin/login" } });
  }

  // Per-IP rate-limit on TOTP attempts (5 / 5min), same policy as before.
  const ip = clientIp(req);
  const rl = rateLimit("admin_totp", ip, 5, 5 * 60 * 1000);
  if (!rl.ok) {
    return back(`Zu viele Versuche. Bitte in ${rl.retryAfterSeconds}s erneut versuchen.`, undefined, {
      "Retry-After": String(rl.retryAfterSeconds),
    });
  }

  const form = await req.formData();
  const totp = String(form.get("totp") ?? "").trim();
  const keyInput = String(form.get("key") ?? "");
  const deviceName = String(form.get("name") ?? "").trim().slice(0, 40);
  const inviteToken = String(form.get("invite") ?? "").trim();

  const deviceRaw = readCookie(req, "klar_device");
  const knownDevice = await verifyDeviceCookie(deviceRaw, DEVICE_SECRET());

  // TOTP required on every path.
  const totpOk = await verifyTOTP(TOTP_SECRET(), totp);
  if (!totpOk) {
    return back("Code falsch oder abgelaufen.", inviteToken || undefined);
  }

  let issueDeviceCookie = false;
  let newName = knownDevice?.name ?? "";
  let consumedInvite: string | null = null;

  if (!knownDevice) {
    if (inviteToken) {
      const invite = await fetchInvite(inviteToken);
      if (!invite) {
        return back("Invite-Link ungültig, abgelaufen oder schon eingelöst.", inviteToken);
      }
      if (!deviceName) {
        return back("Bitte Gerätename angeben.", inviteToken);
      }
      issueDeviceCookie = true;
      newName = deviceName;
      consumedInvite = inviteToken;
    } else {
      if (!ctEqual(keyInput, KEY())) {
        return back("Admin-Key falsch.");
      }
      if (!deviceName) {
        return back("Bitte Gerätename angeben.");
      }
      issueDeviceCookie = true;
      newName = deviceName;
    }
  }

  const headers = new Headers({ Location: "/admin" });
  headers.append("Set-Cookie", clearLegacyRootPath());
  headers.append("Set-Cookie", clearLegacyDeviceRootPath());
  headers.append("Set-Cookie", sessionCookieHeader(KEY()));
  if (issueDeviceCookie) {
    const signed = await signDeviceCookie(
      { deviceId: newDeviceId(), name: newName, issuedAt: Math.floor(Date.now() / 1000) },
      DEVICE_SECRET(),
    );
    headers.append("Set-Cookie", deviceCookieHeader(signed));
  }

  if (consumedInvite) {
    void markInviteUsed(consumedInvite, newName);
  }

  return new Response(null, { status: 303, headers });
}
