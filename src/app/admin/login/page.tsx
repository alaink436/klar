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
//
// Look (redesign 2026-10-08, ticket 05): the existing Klar symbol large on top,
// unchanged, then a calm form in a texture card. Styles: the "Login" section at
// the end of admin/admin.css.

import { headers } from "next/headers";
import { ArrowRight, KeyRound } from "lucide-react";
import { esc } from "../_shared";
import { adminConfig, readAdminSession } from "../../../lib/adminSession";
import { fetchInvite } from "../../../lib/adminSettings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GridPattern } from "@/components/ui/grid-pattern";
import { TextureCard } from "@/components/ui/texture-card";
import OtpField from "./OtpField";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Login has no AdminShell, so it draws the grid and glow itself.
function Chrome({
  eyebrow,
  title,
  tag,
  children,
}: {
  eyebrow: string;
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <title>Anmeldung · Klar Control</title>
      <meta name="robots" content="noindex" />
      <link rel="icon" type="image/png" href="/logo/klar-192.png" />
      <div className="klar-login">
        <div className="klar-hintergrund" aria-hidden="true">
          <GridPattern width={56} height={56} />
        </div>
        <BackLink />
        <main className="klar-login-spalte">
          <div className="klar-login-symbol">
            <img src="/logo/klar-symbol.png" alt="Klar" width={500} height={500} />
          </div>
          <div className="klar-login-kopf">
            <span className="klar-marke pl-[3px]">
              <span
                aria-hidden="true"
                className="flex size-4 items-center justify-center rounded-full bg-[linear-gradient(180deg,#fff,#cfcfcf)] text-[#0a0a0a] [&_svg]:size-2.5"
              >
                <KeyRound />
              </span>
              {eyebrow}
            </span>
            <h1>{title}</h1>
            <p>{tag}</p>
          </div>
          {children}
        </main>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <a className="klar-pille klar-pille-dunkel klar-login-zurueck" href="/" title="Zurück zu getklar.org">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      getklar.org
    </a>
  );
}

function SetupHint() {
  const config = adminConfig();
  const missing = [
    config.adminKey ? "" : "KLAR_ADMIN_KEY",
    config.totpSecret ? "" : "KLAR_TOTP_SECRET",
    config.deviceSecret ? "" : "KLAR_DEVICE_SECRET",
  ].filter(Boolean);
  return (
    <Chrome
      eyebrow="Klar Control"
      title="Setup"
      tag="Bevor sich jemand anmelden kann, müssen ein paar Server-Variablen in Vercel gesetzt werden."
    >
      <TextureCard className="klar-login-karte">
        <div className="flex flex-wrap gap-2">
          {missing.map((m) => (
            <Badge key={m} tone="warn" className="[font-family:var(--font-mono)]">{m}</Badge>
          ))}
        </div>
        <p className="mt-4 mb-0 text-[13px] leading-normal text-fg-3">
          Anleitung: <code className="[font-family:var(--font-mono)] text-fg-2">SECURITY-SETUP.md</code> im Klar-Repo.
        </p>
      </TextureCard>
      <p className="klar-login-fuss"><span>Intern · getklar.org</span></p>
    </Chrome>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; err?: string }>;
}) {
  const session = await readAdminSession((await headers()).get("cookie"));
  if (session.status === "not-configured") return <SetupHint />;
  // Known device (with or without a live session): greet it, ask only for the code.
  const knownDeviceName =
    session.status === "ok" || session.status === "no-session" ? session.deviceName : null;

  const sp = await searchParams;

  const inviteToken = (sp.invite ?? "").trim();
  let err = sp.err ? String(sp.err) : "";
  let inviteName: string | null = null;
  let validInvite = false;

  if (inviteToken && knownDeviceName === null) {
    const invite = await fetchInvite(inviteToken);
    if (!invite) {
      if (!err) err = "Invite-Link ungültig, abgelaufen oder schon eingelöst.";
    } else {
      validInvite = true;
      inviteName = invite.invited_name;
    }
  }

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
    <Chrome eyebrow={eyebrow} title={mark} tag={tag}>
      <TextureCard className="klar-login-karte">
        {err ? <div className="klar-login-fehler" role="alert">{err}</div> : null}
        <form method="POST" action="/admin/login/submit" className="klar-login-form" autoComplete="off">
          {hasInvite ? <input type="hidden" name="invite" value={esc(inviteToken)} /> : null}
          {showKeyInput ? (
            <div className="klar-login-feld">
              <label className="klar-login-label" htmlFor="key-input">Admin-Key</label>
              <input className="klar-login-eingabe" id="key-input" name="key" type="password" placeholder="••••••••" autoComplete="off" required />
            </div>
          ) : null}
          {showNameInput ? (
            <div className="klar-login-feld">
              <label className="klar-login-label" htmlFor="name-input">Gerätename</label>
              <input className="klar-login-eingabe" id="name-input" name="name" type="text" placeholder="z.B. MacBook, Büro-PC" autoComplete="off" maxLength={40} required />
            </div>
          ) : null}
          <div className="klar-login-feld">
            <label className="klar-login-label">Authenticator-Code</label>
            <OtpField />
          </div>
          <Button variant="pill" type="submit" className="mt-1 h-11 w-full text-sm">
            Anmelden
            <ArrowRight />
          </Button>
        </form>
      </TextureCard>
      <p className="klar-login-fuss">
        <span>{foot}</span>
        <span>getklar.org</span>
      </p>
    </Chrome>
  );
}
