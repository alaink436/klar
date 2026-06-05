// Klar Control · Templates — per-app outreach templates (hashtags + Mail-1/2).
//
// Server component. Lists every app × language template from the outreach store
// and renders inline edit forms that POST to /admin/templates/save. Same chrome
// and 2FA gate as the rest of /admin. Inner content is built as an HTML string
// (reusing the shared esc helper) and injected, so output stays byte-identical
// to the old route.ts templatesView. The save handler redirects back here with
// ?msg= for the flash.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, KLAR_INBOX_SERVICE_KEY
//      (outreach store) + APIFY_API_TOKEN presence check.

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
  esc,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import { listAppTemplates, isOutreachConfigured, type AppMailTemplate } from "../../../lib/outreachStore";
import { KLAR_APPS } from "../../../lib/klarApps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Quiet-Pill (mirrors route.ts): one neutral surface tone for all pills, colour
// only as restrained text tinting via tokens. Kept local to this route.
type PillTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";
const TONE_FG: Record<PillTone, string> = {
  neutral: "var(--fg-3)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  accent: "var(--fg)",
};
function quietPill(label: string, tone: PillTone = "neutral", extra = ""): string {
  return `<span class="pill" style="background:var(--surface-2);border:1px solid var(--line);color:${TONE_FG[tone]};font-weight:600;${extra}">${esc(label)}</span>`;
}

async function templatesMain(): Promise<string> {
  if (!isOutreachConfigured()) {
    return `<h1>Templates</h1><p class="sub muted">Outreach-Tracker braucht <span class="warn">KLAR_INBOX_SERVICE_KEY</span> in Vercel (anime-vault Service-Role).</p>`;
  }

  const templates = await listAppTemplates();

  // Group: one row per (app_slug, language). Sorted by KLAR_APPS order
  // first so the visual layout matches the rest of the dashboard.
  const byApp = new Map<string, AppMailTemplate[]>();
  for (const t of templates) {
    if (!byApp.has(t.app_slug)) byApp.set(t.app_slug, []);
    byApp.get(t.app_slug)!.push(t);
  }

  const fmtRel = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    const ago = Date.now() - d.getTime();
    const min = Math.floor(ago / 60000);
    if (min < 1) return "gerade";
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    return `${Math.floor(hr / 24)}d`;
  };

  // Apify-Token Status: only env-presence-check, never expose the value.
  const apifyTokenPresent = Boolean(process.env.APIFY_API_TOKEN);

  const m1Count = templates.filter((t) => t.mail1_subject && t.mail1_body).length;
  const m2Count = templates.filter((t) => t.mail2_subject && t.mail2_body).length;
  const cards = `<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
    <div class="card"><div class="k">Apify-Token</div><div class="v" style="font-size:18px">${apifyTokenPresent ? "✓ in Vercel" : "in n8n-Cred"}</div><div class="s">${apifyTokenPresent ? "KLAR_APIFY_TOKEN env gesetzt" : "via httpHeaderAuth Cred l8T8zGn0SrQSd4ws"}</div></div>
    <div class="card"><div class="k">Templates</div><div class="v">${templates.length}</div><div class="s">App × Sprache (6 Apps × DE/EN)</div></div>
    <div class="card"><div class="k">Mail-1</div><div class="v">${m1Count}</div><div class="s">Soft Open komplett</div></div>
    <div class="card"><div class="k">Mail-2</div><div class="v">${m2Count}</div><div class="s">Auto-Reply komplett</div></div>
  </div>`;

  const rows = KLAR_APPS.flatMap((appMeta) => {
    const tpls = byApp.get(appMeta.slug) ?? [];
    if (tpls.length === 0) {
      return [`<tr><td><strong>${esc(appMeta.name)}</strong><div class="muted" style="font-size:11px">${esc(appMeta.slug)}</div></td>
        <td colspan="5" class="muted" style="font-style:italic">noch keine Templates angelegt — <a class="applink" href="#new-${esc(appMeta.slug)}">unten anlegen</a></td></tr>`];
    }
    return tpls.map((t) => {
      const hashtagsStr = (t.hashtags ?? []).join(", ");
      const m1Done = Boolean(t.mail1_subject && t.mail1_body);
      const m2Done = Boolean(t.mail2_subject && t.mail2_body);
      const m1Badge = m1Done
        ? quietPill("M1 ok", "success", "font-size:9px")
        : quietPill("M1 leer", "warning", "font-size:9px");
      const m2Badge = m2Done
        ? quietPill("M2 ok", "success", "font-size:9px")
        : quietPill("M2 leer", "warning", "font-size:9px");
      const doneBadge = `<span style="display:inline-flex;gap:4px">${m1Badge}${m2Badge}</span>`;
      return `<tr data-row-id="${esc(appMeta.slug)}-${esc(t.language)}">
        <td><button type="button" class="btn ghost" onclick="this.closest('tbody').querySelector('[data-edit-for=&quot;${esc(appMeta.slug)}-${esc(t.language)}&quot;]').style.display=this.closest('tbody').querySelector('[data-edit-for=&quot;${esc(appMeta.slug)}-${esc(t.language)}&quot;]').style.display==='none'?'table-row':'none';" style="padding:2px 7px;font-size:11px;margin-right:6px">▸</button><strong>${esc(appMeta.name)}</strong><div class="muted" style="font-size:11px">${esc(appMeta.slug)}</div></td>
        <td><span class="pill" style="font-size:10px;text-transform:uppercase">${esc(t.language)}</span></td>
        <td>${doneBadge}</td>
        <td class="muted" style="font-size:11px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(hashtagsStr)}">${esc(hashtagsStr || "—")}</td>
        <td class="muted" style="font-size:11px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.mail1_subject ?? "")}">${esc(t.mail1_subject || "—")}</td>
        <td class="muted" style="font-size:11px;white-space:nowrap">${fmtRel(t.updated_at)}</td>
      </tr>
      <tr data-edit-for="${esc(appMeta.slug)}-${esc(t.language)}" style="display:none"><td colspan="6" style="padding:14px 18px;background:var(--surface-2)">
        <form method="POST" action="/admin/templates/save" style="display:flex;flex-direction:column;gap:12px">
          <input type="hidden" name="app_slug" value="${esc(appMeta.slug)}"/>
          <input type="hidden" name="language" value="${esc(t.language)}"/>
          <label style="display:flex;flex-direction:column">
            <span class="k" style="margin-bottom:5px">Hashtags <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">comma-sep, ohne #, max 8 für Cost-Control</span></span>
            <input type="text" name="hashtags" value="${esc(hashtagsStr)}" maxlength="500" style="padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:12px;font-family:var(--font-mono)"/>
          </label>
          <label style="display:flex;flex-direction:column">
            <span class="k" style="margin-bottom:5px">Mail-1 Subject</span>
            <input type="text" name="mail1_subject" value="${esc(t.mail1_subject ?? "")}" maxlength="200" style="padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
          </label>
          <label style="display:flex;flex-direction:column">
            <span class="k" style="margin-bottom:5px">Mail-1 Body <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">{{NAME}}/{{HANDLE}}/{{NICHE_REF}}/{{SPORT}} Platzhalter</span></span>
            <textarea name="mail1_body" rows="14" style="padding:10px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical;line-height:1.5">${esc(t.mail1_body ?? "")}</textarea>
          </label>
          <details>
            <summary style="cursor:pointer;font-size:12px;color:var(--fg-2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Mail-2 (Reply-Auto, optional)</summary>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">
              <label style="display:flex;flex-direction:column">
                <span class="k" style="margin-bottom:5px">Mail-2 Subject <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">leer = "Re: ..." vom Reply-Tracker</span></span>
                <input type="text" name="mail2_subject" value="${esc(t.mail2_subject ?? "")}" maxlength="200" style="padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
              </label>
              <label style="display:flex;flex-direction:column">
                <span class="k" style="margin-bottom:5px">Mail-2 Body</span>
                <textarea name="mail2_body" rows="14" style="padding:10px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical;line-height:1.5">${esc(t.mail2_body ?? "")}</textarea>
              </label>
            </div>
          </details>
          <label style="display:flex;flex-direction:column">
            <span class="k" style="margin-bottom:5px">Notes <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">intern</span></span>
            <input type="text" name="notes" value="${esc(t.notes ?? "")}" maxlength="500" style="padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:12px"/>
          </label>
          <div style="display:flex;justify-content:flex-end">
            <button type="submit" class="btn" style="padding:8px 18px;font-size:13px">Speichern</button>
          </div>
        </form>
      </td></tr>`;
    });
  }).join("");

  return `<h1>Templates</h1>
    <p class="sub">Per-App Outreach-Templates &mdash; Hashtags für Apify-Discovery, Mail-1 + Mail-2 für Brevo-Send. Editierbar pro App × Sprache. Die Wave-Starter-Form lädt diese Defaults automatisch wenn du genau eine App auswählst.</p>
    ${cards}
    <h2>Templates pro App</h2>
    <table>
      <thead><tr><th>App</th><th>Lang</th><th>Status</th><th>Hashtags</th><th>Mail-1 Subject</th><th>Updated</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">keine Templates</td></tr>`}</tbody>
    </table>
    <p class="sub muted" style="margin-top:24px;font-size:12px">✓ Der n8n Wave-Consumer liest diese Templates pro App live aus der DB. Editierst du hier ein Subject oder Body, nutzt die nächste Welle automatisch den neuen Text — pro App ihr eigenes. Custom-Override im Welle-Form ist möglich (überschreibt App-Defaults für die ganze Welle).</p>`;
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  // Auth — identical gate to brain/cal/bookings/revenue (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const apps = getApps();
  const main = await templatesMain();
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const sidebar = adminSidebar("templates", apps);
  const topbar = `
    <span class="crumb"><b>Templates</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Templates · Klar Control</title>
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
          <div className="content" dangerouslySetInnerHTML={{ __html: flash + main }} />
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
