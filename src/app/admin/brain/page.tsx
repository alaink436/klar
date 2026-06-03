// Klar Control · AI-Brain view.
//
// Server component. Same 2FA gate as the rest of /admin (device cookie +
// admin session), then renders the Obsidian-style BrainExplorer inside the
// Klar Control chrome. The admin sees the full graph (every non-secret
// folder); note bodies load on demand from /admin/brain/note, which holds the
// GitHub token and re-checks the secret-folder guard. Secrets/Credentials are
// excluded at graph-build time and in fetchNote, so they never surface here.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, BRAIN_GITHUB_TOKEN.

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
import { scopeGraph, hasToken } from "@/lib/brainVault";
import BrainExplorer from "@/app/components/brain/BrainExplorer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BrainPage() {
  // Auth — identical gate to analytics/page.tsx (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  // Full graph (all non-secret folders) baked at build time.
  const graph = scopeGraph(null);
  const tokenReady = hasToken();

  const sidebar = adminSidebar("brain", getApps());
  const topbar = `
    <span class="crumb"><b>AI-Brain</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>AI-Brain · Klar Control</title>
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
            <h1>AI-Brain</h1>
            <p className="sub">
              Dein Wissensspeicher als Graph. Node anklicken oder im Baum suchen, um eine Notiz zu öffnen.
            </p>

            {!tokenReady && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="k">Notiz-Inhalte deaktiviert</div>
                <p className="s">
                  Der Graph wird angezeigt, aber zum Öffnen von Notizen fehlt{" "}
                  <code>BRAIN_GITHUB_TOKEN</code> (Fine-grained PAT, Contents: Read) in den
                  Vercel-Env-Vars. Nach dem Setzen neu deployen.
                </p>
              </div>
            )}

            <div style={{ height: "calc(100dvh - 200px)", minHeight: 520 }}>
              <BrainExplorer graph={graph} noteApi="/admin/brain/note" />
            </div>
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
