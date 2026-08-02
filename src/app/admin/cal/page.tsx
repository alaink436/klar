// Klar Control · Cal Admin view.
//
// Server component. Full-bleed iframe of cal.getklar.org inside the Klar
// Control chrome (same STYLE/ICON + same 2FA gate as the rest of /admin).
// Nginx sends Content-Security-Policy: frame-ancestors 'self'
// https://getklar.org so the embed is permitted. The user signs in once
// inside the iframe; the cal.getklar.org session cookie persists afterwards.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ICON,
  readCookieFromString,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import CalendarTabs from "../bookings/CalendarTabs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CalPage() {
  // Auth — identical gate to brain/analytics/settings (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");
  const topbar = `
    <span class="crumb"><b>Cal Admin</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Cal Admin · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <CalendarTabs active="cal" />
        {/* Negative margins pull the iframe out to the content padding; the tab
            strip above keeps its own spacing, so the height budget loses the
            strip's row as well as the topbar's. */}
        <div style={{ margin: "0 -28px -28px -28px", height: "calc(100vh - 130px)", position: "relative" }}>
          <iframe
            src="https://cal.getklar.org"
            title="Cal Admin"
            style={{ width: "100%", height: "100%", border: 0, display: "block", background: "var(--surface)" }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-storage-access-by-user-activation"
            allow="clipboard-read; clipboard-write; camera; microphone"
            referrerPolicy="origin"
          />
        </div>
      </div>
    </>
  );
}
