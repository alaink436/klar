// Klar Control login — POST handler. Split out from the old login route.ts so
// /admin/login can be a React page (page.tsx) that embeds the input-otp field.
// Validates admin-key + TOTP (+ device name on new devices, or an invite
// token) and issues the device + session cookies. On failure it redirects back
// to /admin/login?err=… so the page can show the message; on success it 303s to
// /admin. Auth logic is unchanged from the previous implementation.

import { verifyTOTP } from "../../../../lib/totp";
import {
  signDeviceCookie,
  deviceCookieHeader,
  newDeviceId,
} from "../../../../lib/deviceCookie";
import {
  adminConfig,
  adminKeyMatches,
  readAdminSession,
  startSessionCookies,
} from "../../../../lib/adminSession";
import { fetchInvite, markInviteUsed } from "../../../../lib/adminSettings";
import { clientIp, rateLimit } from "../../../../lib/apiGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const config = adminConfig();
  const session = await readAdminSession(req.headers.get("cookie"), config);
  if (session.status === "not-configured") {
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

  const knownDevice =
    session.status === "ok" || session.status === "no-session" ? session.deviceName : null;

  // TOTP required on every path.
  const totpOk = await verifyTOTP(config.totpSecret, totp);
  if (!totpOk) {
    return back("Code falsch oder abgelaufen.", inviteToken || undefined);
  }

  let issueDeviceCookie = false;
  let newName = knownDevice ?? "";
  let consumedInvite: string | null = null;

  if (knownDevice === null) {
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
      if (!adminKeyMatches(keyInput, config)) {
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
  headers.append("Set-Cookie", clearLegacyDeviceRootPath());
  for (const c of startSessionCookies(config)) headers.append("Set-Cookie", c);
  if (issueDeviceCookie) {
    const signed = await signDeviceCookie(
      { deviceId: newDeviceId(), name: newName, issuedAt: Math.floor(Date.now() / 1000) },
      config.deviceSecret,
    );
    headers.append("Set-Cookie", deviceCookieHeader(signed));
  }

  if (consumedInvite) {
    void markInviteUsed(consumedInvite, newName);
  }

  return new Response(null, { status: 303, headers });
}
