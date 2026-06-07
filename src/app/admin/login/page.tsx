// Klar Control login — GET view. React Server Component that renders the
// chrome + form and embeds the real input-otp field (<OtpField/>). The POST
// handler lives in ./submit/route.ts (a segment can't host both page.tsx and
// route.ts). Errors come back as ?err= after a failed submit redirect.
//
// Flows mirror the previous route.ts:
//   - misconfig (missing env)  -> setup hint
//   - invite (?invite=, no device cookie) -> name + code, no admin-key
//   - new device -> admin-key + name + code
//   - known device -> code only

import { headers } from "next/headers";
import {
  ICON,
  readCookieFromString,
  esc,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { fetchInvite } from "../../../lib/adminSettings";
import OtpField from "./OtpField";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

void ICON;

const KEY = () => process.env.KLAR_ADMIN_KEY ?? "";
const TOTP_SECRET = () => process.env.KLAR_TOTP_SECRET ?? "";
const DEVICE_SECRET = () => process.env.KLAR_DEVICE_SECRET ?? "";

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <title>Anmeldung · Klar Control</title>
      <meta name="robots" content="noindex" />
      <link rel="icon" type="image/png" href="/logo/klar-192.png" />
      {children}
    </>
  );
}

function BackLink() {
  return (
    <a className="login-back" href="/" title="Zurück zu getklar.org">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      getklar.org
    </a>
  );
}

// Rendered as raw HTML so the inline onclick (no client bundle) keeps working,
// matching the topbar toggle on the other admin pages.
const LOGIN_THEME_TOGGLE = `<button type="button" class="tbtn" onclick="klarToggleTheme()" aria-label="Theme wechseln" title="Theme wechseln"><svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg><svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg></button>`;

function SetupHint() {
  const missing = [
    KEY() ? "" : "KLAR_ADMIN_KEY",
    TOTP_SECRET() ? "" : "KLAR_TOTP_SECRET",
    DEVICE_SECRET() ? "" : "KLAR_DEVICE_SECRET",
  ].filter(Boolean);
  return (
    <Chrome>
      <div className="login">
        <BackLink />
        <div className="login-meta" dangerouslySetInnerHTML={{ __html: LOGIN_THEME_TOGGLE }} />
        <div className="login-card">
          <div className="login-head">
            <div className="login-badge"><img src="/logo/klar-symbol.png" alt="Klar" /></div>
            <div className="login-head-text">
              <span className="login-eyebrow">Klar Control</span>
              <span className="login-mark">Setup<span className="dot">.</span></span>
            </div>
          </div>
          <p className="login-tag">Bevor sich jemand anmelden kann, müssen ein paar Server-Variablen in Vercel gesetzt werden.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {missing.map((m) => (
              <code key={m} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, background: "var(--surface-2)", border: "1px solid var(--line)", padding: "8px 12px", borderRadius: 6, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--warning)" }} />{m}
              </code>
            ))}
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>
            Anleitung: <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>SECURITY-SETUP.md</code> im Klar-Repo.
          </p>
          <div className="login-foot"><span className="login-foot-text">Intern · getklar.org</span></div>
        </div>
      </div>
    </Chrome>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; err?: string }>;
}) {
  if (!KEY() || !TOTP_SECRET() || !DEVICE_SECRET()) return <SetupHint />;

  const sp = await searchParams;
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEVICE_SECRET());

  const inviteToken = (sp.invite ?? "").trim();
  let err = sp.err ? String(sp.err) : "";
  let inviteName: string | null = null;
  let validInvite = false;

  if (inviteToken && !device) {
    const invite = await fetchInvite(inviteToken);
    if (!invite) {
      if (!err) err = "Invite-Link ungültig, abgelaufen oder schon eingelöst.";
    } else {
      validInvite = true;
      inviteName = invite.invited_name;
    }
  }

  const knownDeviceName = device ? device.name : null;
  const isNewDevice = knownDeviceName === null;
  const hasInvite = validInvite;
  const showKeyInput = isNewDevice && !hasInvite;
  const showNameInput = isNewDevice;

  const eyebrow = hasInvite ? "Klar Control · Invite" : isNewDevice ? "Klar Control · Neues Gerät" : "Klar Control";
  const mark = hasInvite || isNewDevice ? "Einrichten" : "Willkommen";
  const tag = hasInvite
    ? `Einmal-Invite${inviteName ? ` für ${inviteName}` : ""}. Wähle einen Namen für dieses Gerät und gib deinen Code ein.`
    : isNewDevice
      ? "Neues Gerät einrichten. Wir merken uns den Browser danach für 10 Jahre."
      : `Schön dass du wieder da bist, ${knownDeviceName ?? ""}. Code aus der Authenticator-App reicht.`;
  const foot = hasInvite
    ? "Token wird nach Anmeldung verbraucht"
    : isNewDevice
      ? "Gerät wird nach erfolgreicher Anmeldung registriert"
      : "TOTP läuft alle 30 Sekunden";

  return (
    <Chrome>
      <div className="login">
        <BackLink />
        <div className="login-meta" dangerouslySetInnerHTML={{ __html: LOGIN_THEME_TOGGLE }} />
        <div className="login-card">
          <div className="login-head">
            <div className="login-badge"><img src="/logo/klar-symbol.png" alt="Klar" /></div>
            <div className="login-head-text">
              <span className="login-eyebrow">{eyebrow}</span>
              <span className="login-mark">{mark}<span className="dot">.</span></span>
            </div>
          </div>
          <p className="login-tag">{tag}</p>
          {err ? <div className="login-err" role="alert">{err}</div> : null}
          <form method="POST" action="/admin/login/submit" style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
            {hasInvite ? <input type="hidden" name="invite" value={esc(inviteToken)} /> : null}
            {showKeyInput ? (
              <div className="login-field">
                <label className="login-label" htmlFor="key-input">Admin-Key</label>
                <input className="login-input" id="key-input" name="key" type="password" placeholder="••••••••" autoComplete="off" required />
              </div>
            ) : null}
            {showNameInput ? (
              <div className="login-field">
                <label className="login-label" htmlFor="name-input">Gerätename</label>
                <input className="login-input" id="name-input" name="name" type="text" placeholder="z.B. MacBook, Büro-PC" autoComplete="off" maxLength={40} required />
              </div>
            ) : null}
            <div className="login-field">
              <label className="login-label">Authenticator-Code</label>
              <OtpField />
            </div>
            <button className="btn pop login-submit" type="submit">Anmelden</button>
          </form>
          <div className="login-foot">
            <span className="login-foot-text">{foot}</span>
            <span className="login-foot-text" style={{ opacity: 0.7 }}>getklar.org</span>
          </div>
        </div>
      </div>
    </Chrome>
  );
}
