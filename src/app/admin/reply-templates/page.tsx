// Klar Control · Antwort-Vorlagen — editable inbox-composer reply templates.
//
// Server component. Lists every reply template (klar_reply_templates) grouped by
// language with inline expand-to-edit forms that POST to
// /admin/reply-templates/save, plus a per-language "add" form and a delete
// action. Same 2FA gate + chrome as the rest of /admin. The inbox composer reads
// these live via getReplyTemplates() (DB with hardcoded fallback).

import { headers } from "next/headers";
import AdminSidebar from "../AdminSidebar";
import { redirect } from "next/navigation";
import {
  ICON,
  readCookieFromString,
  esc,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import {
  listReplyTemplateRows,
  isReplyTemplateStoreConfigured,
  REPLY_LANGS,
  type ReplyTemplateRow,
} from "../../../lib/replyTemplateStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LANG_NAME: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  it: "Italiano",
  fr: "Français",
};

const inputCss =
  "padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px";
const bodyCss =
  "padding:10px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical;line-height:1.5";
const labelCss = "margin-bottom:5px";

function fmtRel(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "gerade";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

// Hidden expand/collapse toggle, mirrors the templates page pattern.
function toggleBtn(editId: string): string {
  const sel = `[data-edit-for=&quot;${esc(editId)}&quot;]`;
  return `<button type="button" class="btn ghost" style="padding:2px 7px;font-size:11px;margin-right:6px" onclick="var r=this.closest('tbody').querySelector('${sel}');r.style.display=r.style.display==='none'?'table-row':'none';">▸</button>`;
}

function editRow(t: ReplyTemplateRow): string {
  const editId = `${t.language}-${t.template_key}`;
  return `<tr>
      <td>${toggleBtn(editId)}<strong>${esc(t.label)}</strong><div class="muted" style="font-size:11px;font-family:var(--font-mono)">${esc(t.template_key)}</div></td>
      <td class="muted" style="font-size:11px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.subject)}">${esc(t.subject || "—")}</td>
      <td class="muted" style="font-size:11px;white-space:nowrap">${fmtRel(t.updated_at)}</td>
    </tr>
    <tr data-edit-for="${esc(editId)}" style="display:none"><td colspan="3" style="padding:14px 18px;background:var(--surface-2)">
      <form method="POST" action="/admin/reply-templates/save" style="display:flex;flex-direction:column;gap:12px">
        <input type="hidden" name="language" value="${esc(t.language)}"/>
        <input type="hidden" name="template_key" value="${esc(t.template_key)}"/>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <label style="display:flex;flex-direction:column;flex:1;min-width:200px">
            <span class="k" style="${labelCss}">Label <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">Anzeige im Dropdown</span></span>
            <input type="text" name="label" value="${esc(t.label)}" maxlength="120" required style="${inputCss}"/>
          </label>
          <label style="display:flex;flex-direction:column;width:120px">
            <span class="k" style="${labelCss}">Reihenfolge</span>
            <input type="number" name="sort_order" value="${t.sort_order}" min="0" max="999" style="${inputCss};font-family:var(--font-mono)"/>
          </label>
        </div>
        <label style="display:flex;flex-direction:column">
          <span class="k" style="${labelCss}">Subject</span>
          <input type="text" name="subject" value="${esc(t.subject)}" maxlength="200" style="${inputCss}"/>
        </label>
        <label style="display:flex;flex-direction:column">
          <span class="k" style="${labelCss}">Body <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">{{name}} / {{handle}} Platzhalter</span></span>
          <textarea name="body" rows="14" style="${bodyCss}">${esc(t.body)}</textarea>
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span class="muted" style="font-size:11px">Wirkt sofort im Inbox-Composer.</span>
          <button type="submit" class="btn" style="padding:8px 18px;font-size:13px">Speichern</button>
        </div>
      </form>
      <form method="POST" action="/admin/reply-templates/delete" style="margin-top:8px" onsubmit="return confirm('Diese Vorlage wirklich löschen?');">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <button type="submit" class="btn ghost" style="padding:5px 12px;font-size:12px;color:var(--danger);border-color:var(--danger)">Löschen</button>
      </form>
    </td></tr>`;
}

function addForm(lang: string): string {
  return `<details style="margin:10px 0 26px">
    <summary style="cursor:pointer;font-size:12px;color:var(--fg-2);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">+ Neue Vorlage (${esc(LANG_NAME[lang] ?? lang)})</summary>
    <form method="POST" action="/admin/reply-templates/save" style="display:flex;flex-direction:column;gap:12px;margin-top:12px;padding:14px 18px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px">
      <input type="hidden" name="language" value="${esc(lang)}"/>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <label style="display:flex;flex-direction:column;width:200px">
          <span class="k" style="${labelCss}">Key <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">a-z 0-9 _</span></span>
          <input type="text" name="template_key" maxlength="40" required pattern="[a-zA-Z0-9_]+" style="${inputCss};font-family:var(--font-mono)"/>
        </label>
        <label style="display:flex;flex-direction:column;flex:1;min-width:200px">
          <span class="k" style="${labelCss}">Label</span>
          <input type="text" name="label" maxlength="120" required style="${inputCss}"/>
        </label>
        <label style="display:flex;flex-direction:column;width:120px">
          <span class="k" style="${labelCss}">Reihenfolge</span>
          <input type="number" name="sort_order" value="10" min="0" max="999" style="${inputCss};font-family:var(--font-mono)"/>
        </label>
      </div>
      <label style="display:flex;flex-direction:column">
        <span class="k" style="${labelCss}">Subject</span>
        <input type="text" name="subject" value="Re: Klar x {{name}}" maxlength="200" style="${inputCss}"/>
      </label>
      <label style="display:flex;flex-direction:column">
        <span class="k" style="${labelCss}">Body <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">{{name}} / {{handle}} Platzhalter</span></span>
        <textarea name="body" rows="10" style="${bodyCss}"></textarea>
      </label>
      <div style="display:flex;justify-content:flex-end">
        <button type="submit" class="btn" style="padding:8px 18px;font-size:13px">Anlegen</button>
      </div>
    </form>
  </details>`;
}

async function replyTemplatesMain(): Promise<string> {
  if (!isReplyTemplateStoreConfigured()) {
    return `<h1>Antwort-Vorlagen</h1><p class="sub muted">Braucht <span class="warn">KLAR_INBOX_SERVICE_KEY</span> in Vercel (anime-vault Service-Role).</p>`;
  }

  const rows = await listReplyTemplateRows();
  const byLang = new Map<string, ReplyTemplateRow[]>();
  for (const l of REPLY_LANGS) byLang.set(l, []);
  for (const r of rows) {
    if (!byLang.has(r.language)) byLang.set(r.language, []);
    byLang.get(r.language)!.push(r);
  }

  const sections = REPLY_LANGS.map((lang) => {
    const tpls = (byLang.get(lang) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const body = tpls.length
      ? tpls.map(editRow).join("")
      : `<tr><td colspan="3" class="muted" style="font-style:italic">noch keine Vorlagen — unten anlegen</td></tr>`;
    return `<h2 style="margin-top:28px">${esc(LANG_NAME[lang] ?? lang)} <span class="muted" style="font-size:13px;font-weight:400">${tpls.length}</span></h2>
      <table>
        <thead><tr><th>Label / Key</th><th>Subject</th><th>Updated</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${addForm(lang)}`;
  }).join("");

  return `<h1>Antwort-Vorlagen</h1>
    <p class="sub">Vorlagen für den Inbox-Composer (Dropdown &bdquo;Vorlage&ldquo;) &mdash; pro Sprache. <code>{{name}}</code> und <code>{{handle}}</code> werden beim Einsetzen ersetzt. Änderungen wirken sofort im Inbox, kein Deploy nötig.</p>
    ${sections}`;
}

export default async function ReplyTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
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
  const main = await replyTemplatesMain();
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const topbar = `
    <span class="crumb"><b>Antwort-Vorlagen</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Antwort-Vorlagen · Klar Control</title>
      <div className="layout">
        <AdminSidebar active={"reply-templates"} apps={apps} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content" dangerouslySetInnerHTML={{ __html: flash + main }} />
        </main>
      </div>
    </>
  );
}
