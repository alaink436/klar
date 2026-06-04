// Klar Control · Mailer — manual control panel for the in-app outreach mailer.
//
// Server component: same 2FA/device gate as the rest of /admin. Computes how
// many targets are due for Mail-1 / Mail-2 and surfaces the relevant env config
// (sender on/off, cron secret, inbound domain), then mounts <MailerClient/>
// which drives dry-run previews and (env-gated) real sends via
// /admin/mailer/run. The Vercel cron hits the same engine on a schedule.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  readCookieFromString,
  adminSidebar,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import { listTargetsForMail1, listTargetsForMail2 } from "../../../lib/outreachStore";
import MailerClient from "./MailerClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MailerPage() {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const apps = getApps();
  const cutoff = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const [m1, m2] = await Promise.all([
    listTargetsForMail1(500),
    listTargetsForMail2(cutoff, 500),
  ]);

  const senderEnabled = process.env.KLAR_OUTREACH_SENDER === "on";
  const cronSet = Boolean(process.env.CRON_SECRET);
  const inboundSet = Boolean(process.env.KLAR_INBOUND_DOMAIN);

  const sidebar = adminSidebar("mailer", apps);
  const topbar = `
    <span class="crumb"><b>Mailer</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Mailer · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <MailerClient
              dueMail1={m1.length}
              dueMail2={m2.length}
              senderEnabled={senderEnabled}
              cronSet={cronSet}
              inboundSet={inboundSet}
            />
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
