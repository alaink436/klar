// Klar Control login. GET renders the form; POST validates admin-key +
// TOTP (plus device-name on new devices) and issues both cookies.
//
// Two flows:
//   - New device  (no klar_device cookie yet): user must provide
//     KLAR_ADMIN_KEY AND a current TOTP code AND pick a device name.
//     On success the server signs a klar_device cookie (10y) and a
//     klar_admin session cookie (12h).
//   - Known device (klar_device verifies): user only needs a current
//     TOTP code. Session cookie gets refreshed.
//
// Misconfig (any of KLAR_ADMIN_KEY, KLAR_TOTP_SECRET, KLAR_DEVICE_SECRET
// missing) shows a setup hint instead of the form — the app refuses to
// authenticate anyone until all three are present.

import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  ctEqual,
  readCookie,
  esc,
} from "../_shared";
import { verifyTOTP } from "../../../lib/totp";
import {
  signDeviceCookie,
  verifyDeviceCookie,
  deviceCookieHeader,
  newDeviceId,
} from "../../../lib/deviceCookie";
import { fetchInvite, markInviteUsed } from "../../../lib/adminSettings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = () => process.env.KLAR_ADMIN_KEY ?? "";
const TOTP_SECRET = () => process.env.KLAR_TOTP_SECRET ?? "";
const DEVICE_SECRET = () => process.env.KLAR_DEVICE_SECRET ?? "";

const SESSION_COOKIE_MAX_AGE = 12 * 60 * 60; // 12h

// S30f: Path=/admin (zurück zum enger-scoped Default). Alle Admin-Endpoints
// liegen jetzt unter /admin/{approve,dispatch,reconcile,...} — Cookie wird
// nur dort gesendet, leakt nicht zu Public-API-Routes.
function sessionCookieHeader(keyValue: string): string {
  return `klar_admin=${encodeURIComponent(keyValue)}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
}

// Cleanup: räumt sowohl die ursprünglichen Path=/admin Cookies als auch
// die S30e Path=/ Cookies aus Browsern auf. Browser löscht den passenden
// Cookie wenn ein leerer mit Max-Age=0 und gleichem Path kommt.
function clearLegacyRootPath(): string {
  return `klar_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
function clearLegacyDeviceRootPath(): string {
  return `klar_device=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function htmlShell(inner: string): Response {
  const body = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Anmeldung · Klar Control</title>
<script>${THEME_INIT_SCRIPT}</script>
<link rel="icon" type="image/png" href="/logo/klar-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_LINK}" rel="stylesheet">
<style>${STYLE}</style></head><body>
<canvas id="klar-smoke-bg" aria-hidden="true"></canvas>
${GLASS_SVG_DEFS}
${inner}
<script>${THEME_TOGGLE_SCRIPT}${SMOKE_BG_SCRIPT}</script>
</body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function setupHint(): Response {
  const missing = [
    KEY() ? "" : "KLAR_ADMIN_KEY",
    TOTP_SECRET() ? "" : "KLAR_TOTP_SECRET",
    DEVICE_SECRET() ? "" : "KLAR_DEVICE_SECRET",
  ].filter(Boolean);
  return htmlShell(`<div class="login"><div class="login-card">
    <div class="login-mark">Klar<span class="dot">.</span></div>
    <p class="login-tag">Setup erforderlich.</p>
    <div class="login-rule"></div>
    <p style="font-family:var(--font-body);font-size:13.5px;color:var(--fg-2);text-align:left;line-height:1.55">
      Folgende Server-Variablen fehlen in Vercel:<br/><br/>
      ${missing.map((m) => `<code style="font-family:var(--font-mono);background:var(--surface-2);padding:2px 8px;border-radius:4px;display:inline-block;margin:2px 0">${esc(m)}</code>`).join("<br/>")}
    </p>
    <p style="font-family:var(--font-body);font-size:12px;color:var(--fg-3);text-align:left;margin-top:18px;line-height:1.5">
      Anleitung: <code>SECURITY-SETUP.md</code> im Klar-Repo.
    </p>
    <p class="login-foot">Intern · getklar.org</p>
  </div></div>`);
}

function renderForm({
  knownDeviceName,
  err,
  inviteToken,
  inviteName,
}: {
  knownDeviceName: string | null;
  err?: string;
  inviteToken?: string;
  inviteName?: string | null;
}): Response {
  const isNewDevice = knownDeviceName === null;
  const hasInvite = Boolean(inviteToken);
  // Invite flow: skip the admin-key input (the invite is the entry pass),
  // still require device-name + TOTP. Known-device flow ignores invites.
  const showKeyInput = isNewDevice && !hasInvite;
  const showNameInput = isNewDevice; // both new-device paths need a name
  const tag = hasInvite
    ? `Eingeladen${inviteName ? `, ${esc(inviteName)}` : ""}`
    : isNewDevice
      ? "Neues Gerät einrichten"
      : `Willkommen zurück, ${esc(knownDeviceName ?? "")}`;
  const foot = hasInvite
    ? "Einmal-Invite. Nach Anmeldung wird der Token verbraucht."
    : isNewDevice
      ? "Gerät wird nach erfolgreicher Anmeldung registriert"
      : "Code aus deiner Authenticator-App";
  return htmlShell(`<div class="login"><div class="login-card">
    <div class="login-badge" aria-hidden="true" style="width:56px;height:56px;padding:6px">
      <img src="/logo/klar-symbol.png" alt="Klar" style="width:100%;height:100%;object-fit:contain;display:block"/>
    </div>
    <div class="login-mark">Klar</div>
    <p class="login-tag">${tag}</p>
    <div class="login-rule"></div>
    ${err ? `<p class="login-err">${esc(err)}</p>` : ""}
    <form method="POST" action="/admin/login" style="display:flex;flex-direction:column;gap:10px">
      ${hasInvite ? `<input type="hidden" name="invite" value="${esc(inviteToken)}"/>` : ""}
      ${showKeyInput ? `<input class="login-input" name="key" type="password" placeholder="Admin-Key" autocomplete="off" required/>` : ""}
      ${showNameInput ? `<input class="login-input" name="name" type="text" placeholder="Gerätename (z.B. PC, Laptop)" autocomplete="off" maxlength="40" required/>` : ""}
      <input class="login-input" name="totp" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6-stelliger Code" autocomplete="one-time-code" autofocus required/>
      <button class="btn" style="margin-top:8px;width:100%;padding:12px;justify-content:center" type="submit">Anmelden</button>
    </form>
    <p class="login-foot">${foot}</p>
  </div></div>`);
}

void ICON; // imported for parity with /admin route, used by shared chrome

export async function GET(req: Request): Promise<Response> {
  if (!KEY() || !TOTP_SECRET() || !DEVICE_SECRET()) return setupHint();
  const deviceRaw = readCookie(req, "klar_device");
  const device = await verifyDeviceCookie(deviceRaw, DEVICE_SECRET());

  // Invite flow: GET /admin/login?invite=TOKEN renders the form without the
  // admin-key input. The invite is the proof you were authorized to log in.
  // Known devices ignore invites — they already have a device cookie.
  const url = new URL(req.url);
  const inviteToken = url.searchParams.get("invite")?.trim() ?? "";
  if (inviteToken && !device) {
    const invite = await fetchInvite(inviteToken);
    if (!invite) {
      return renderForm({
        knownDeviceName: null,
        err: "Invite-Link ungültig, abgelaufen oder schon eingelöst.",
      });
    }
    return renderForm({
      knownDeviceName: null,
      inviteToken,
      inviteName: invite.invited_name,
    });
  }

  return renderForm({ knownDeviceName: device ? device.name : null });
}

export async function POST(req: Request): Promise<Response> {
  if (!KEY() || !TOTP_SECRET() || !DEVICE_SECRET()) return setupHint();

  const form = await req.formData();
  const totp = String(form.get("totp") ?? "").trim();
  const keyInput = String(form.get("key") ?? "");
  const deviceName = String(form.get("name") ?? "").trim().slice(0, 40);
  const inviteToken = String(form.get("invite") ?? "").trim();

  const deviceRaw = readCookie(req, "klar_device");
  const knownDevice = await verifyDeviceCookie(deviceRaw, DEVICE_SECRET());

  // TOTP is required on every path — known device, new device with admin-key,
  // new device with invite token. The TOTP shared secret is the only thing
  // we never delegate, so a leaked invite alone can't sign you in.
  const totpOk = await verifyTOTP(TOTP_SECRET(), totp);
  if (!totpOk) {
    return renderForm({
      knownDeviceName: knownDevice ? knownDevice.name : null,
      err: "Code falsch oder abgelaufen.",
      inviteToken: inviteToken || undefined,
    });
  }

  // Resolve which entry path we're on.
  let issueDeviceCookie = false;
  let newName = knownDevice?.name ?? "";
  let consumedInvite: string | null = null;

  if (!knownDevice) {
    if (inviteToken) {
      // Invite path: validate the token, no admin-key needed.
      const invite = await fetchInvite(inviteToken);
      if (!invite) {
        return renderForm({
          knownDeviceName: null,
          err: "Invite-Link ungültig, abgelaufen oder schon eingelöst.",
          inviteToken,
        });
      }
      if (!deviceName) {
        return renderForm({
          knownDeviceName: null,
          err: "Bitte Gerätename angeben.",
          inviteToken,
          inviteName: invite.invited_name,
        });
      }
      issueDeviceCookie = true;
      newName = deviceName;
      consumedInvite = inviteToken;
    } else {
      // Admin-key path: original behaviour.
      if (!ctEqual(keyInput, KEY())) {
        return renderForm({ knownDeviceName: null, err: "Admin-Key falsch." });
      }
      if (!deviceName) {
        return renderForm({ knownDeviceName: null, err: "Bitte Gerätename angeben." });
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

  // Burn the invite token only after the cookies are queued. We don't await
  // — a slow Supabase round-trip should not block the redirect, and
  // markInviteUsed swallows its own errors.
  if (consumedInvite) {
    void markInviteUsed(consumedInvite, newName);
  }

  return new Response(null, { status: 303, headers });
}
