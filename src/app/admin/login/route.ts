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
import { clientIp, rateLimit } from "../../../lib/apiGuards";

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
<script>${THEME_TOGGLE_SCRIPT}${SMOKE_BG_SCRIPT}
(function(){
  // Auto-advance TOTP: on 6 digits, submit. Also smooth digit-typing UX.
  var t = document.getElementById('totp-input');
  if (t) {
    t.addEventListener('input', function(){
      t.value = t.value.replace(/[^0-9]/g,'').slice(0,6);
      if (t.value.length === 6) {
        // Defer one tick so the value paints before submit-redirect.
        setTimeout(function(){
          var f = t.form;
          if (f && f.checkValidity()) f.requestSubmit ? f.requestSubmit() : f.submit();
        }, 30);
      }
    });
  }
})();
</script>
</body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Tiny theme-toggle button for the login chrome. SVGs come from _shared.ICON
// but we inline a slim sun/moon pair here to avoid pulling the whole admin
// chrome into the login route.
const LOGIN_THEME_TOGGLE = `<button type="button" class="tbtn" onclick="klarToggleTheme()" aria-label="Theme wechseln" title="Theme wechseln">
  <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
  <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
</button>`;

function setupHint(): Response {
  const missing = [
    KEY() ? "" : "KLAR_ADMIN_KEY",
    TOTP_SECRET() ? "" : "KLAR_TOTP_SECRET",
    DEVICE_SECRET() ? "" : "KLAR_DEVICE_SECRET",
  ].filter(Boolean);
  return htmlShell(`<div class="login">
    <div class="login-meta">${LOGIN_THEME_TOGGLE}</div>
    <div class="login-card">
      <div class="login-head">
        <div class="login-badge"><img src="/logo/klar-symbol.png" alt="Klar"/></div>
        <div class="login-head-text">
          <span class="login-eyebrow">Klar Control</span>
          <span class="login-mark">Setup<span class="dot">.</span></span>
        </div>
      </div>
      <p class="login-tag">Bevor sich jemand anmelden kann, müssen ein paar Server-Variablen in Vercel gesetzt werden.</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        ${missing.map((m) => `<code style="font-family:var(--font-mono);font-size:12.5px;background:var(--surface-2);border:1px solid var(--line);padding:8px 12px;border-radius:6px;color:var(--fg);display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--warning)"></span>${esc(m)}</code>`).join("")}
      </div>
      <p style="font-family:var(--font-body);font-size:13px;color:var(--fg-3);margin:0;line-height:1.5">
        Anleitung: <code style="font-family:var(--font-mono);font-size:12px;background:var(--surface-2);padding:1px 6px;border-radius:4px">SECURITY-SETUP.md</code> im Klar-Repo.
      </p>
      <div class="login-foot">
        <span class="login-foot-text">Intern · getklar.org</span>
      </div>
    </div>
  </div>`);
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
  const eyebrow = hasInvite
    ? "Klar Control · Invite"
    : isNewDevice
      ? "Klar Control · Neues Gerät"
      : "Klar Control";
  const mark = hasInvite || isNewDevice ? "Einrichten" : "Willkommen";
  const tag = hasInvite
    ? `Einmal-Invite${inviteName ? ` für ${esc(inviteName)}` : ""}. Wähle einen Namen für dieses Gerät und gib deinen Code ein.`
    : isNewDevice
      ? "Neues Gerät einrichten. Wir merken uns den Browser danach für 10 Jahre."
      : `Schön dass du wieder da bist, ${esc(knownDeviceName ?? "")}. Code aus der Authenticator-App reicht.`;
  const foot = hasInvite
    ? "Token wird nach Anmeldung verbraucht"
    : isNewDevice
      ? "Gerät wird nach erfolgreicher Anmeldung registriert"
      : "TOTP läuft alle 30 Sekunden";
  return htmlShell(`<div class="login">
    <div class="login-meta">${LOGIN_THEME_TOGGLE}</div>
    <div class="login-card">
      <div class="login-head">
        <div class="login-badge"><img src="/logo/klar-symbol.png" alt="Klar"/></div>
        <div class="login-head-text">
          <span class="login-eyebrow">${eyebrow}</span>
          <span class="login-mark">${mark}<span class="dot">.</span></span>
        </div>
      </div>
      <p class="login-tag">${tag}</p>
      ${err ? `<div class="login-err" role="alert">${esc(err)}</div>` : ""}
      <form method="POST" action="/admin/login" style="display:flex;flex-direction:column;gap:14px" autocomplete="off">
        ${hasInvite ? `<input type="hidden" name="invite" value="${esc(inviteToken)}"/>` : ""}
        ${showKeyInput ? `<div class="login-field">
          <label class="login-label" for="key-input">Admin-Key</label>
          <input class="login-input" id="key-input" name="key" type="password" placeholder="••••••••" autocomplete="off" required/>
        </div>` : ""}
        ${showNameInput ? `<div class="login-field">
          <label class="login-label" for="name-input">Gerätename</label>
          <input class="login-input" id="name-input" name="name" type="text" placeholder="z.B. MacBook, Büro-PC" autocomplete="off" maxlength="40" required/>
        </div>` : ""}
        <div class="login-field">
          <label class="login-label" for="totp-input">Authenticator-Code</label>
          <input class="login-input code" id="totp-input" name="totp" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123 456" autocomplete="one-time-code" autofocus required/>
        </div>
        <button class="btn login-submit" type="submit">Anmelden</button>
      </form>
      <div class="login-foot">
        <span class="login-foot-text">${foot}</span>
        <span class="login-foot-text" style="opacity:.7">getklar.org</span>
      </div>
    </div>
  </div>`);
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

  // S32: per-IP rate-limit on TOTP attempts. Brute-forcing a 6-digit code
  // is 1e6 possibilities, at network speed minutes of work. 5 attempts per
  // 5min window keeps the realistic attacker out without locking out a
  // human who fat-fingers the code.
  const ip = clientIp(req);
  const rl = rateLimit("admin_totp", ip, 5, 5 * 60 * 1000);
  if (!rl.ok) {
    const deviceRaw = readCookie(req, "klar_device");
    const knownDevice = await verifyDeviceCookie(deviceRaw, DEVICE_SECRET());
    const body = renderForm({
      knownDeviceName: knownDevice ? knownDevice.name : null,
      err: `Zu viele Versuche. Bitte in ${rl.retryAfterSeconds}s erneut versuchen.`,
    });
    const headers = new Headers(body.headers);
    headers.set("Retry-After", String(rl.retryAfterSeconds));
    return new Response(await body.text(), { status: 429, headers });
  }

  const form = await req.formData();
  const totp = String(form.get("totp") ?? "").trim();
  const keyInput = String(form.get("key") ?? "");
  const deviceName = String(form.get("name") ?? "").trim().slice(0, 40);
  const inviteToken = String(form.get("invite") ?? "").trim();

  const deviceRaw = readCookie(req, "klar_device");
  const knownDevice = await verifyDeviceCookie(deviceRaw, DEVICE_SECRET());

  // TOTP is required on every path: known device, new device with admin-key,
  // new device with invite token. The TOTP shared secret is the only thing
  // we never delegate, so a leaked invite alone cannot sign you in.
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
