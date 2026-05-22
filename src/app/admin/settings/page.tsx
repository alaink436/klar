// Klar Control · Settings view.
//
// Server component. Reads admin_settings + admin_invites from the Klar Inbox
// Supabase (anime-vault project, service-role key). Renders:
//   1) Globale Einstellungen — shader on/off, auto-accept toggle.
//   2) Benachrichtigungen — trigger toggles, batch size, recipient email.
//   3) Zugriff — list of existing invite tokens + generator for a new one.
//
// All form posts go to plain server routes (/admin/settings POST and
// /admin/invite POST), no client-side state. Auth gate matches /admin and
// /admin/analytics (klar_device HMAC + klar_admin session cookie).

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
  esc,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import {
  getAdminSettings,
  listInvites,
  type AdminSettings,
  type AdminInvite,
} from "../../../lib/adminSettings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function appLinks(): string {
  return getApps()
    .map(
      (a) =>
        `<a class="nav" href="/admin?view=${encodeURIComponent(a.slug)}"><span class="d">${ICON.app}</span>${esc(a.name)}</a>`,
    )
    .join("");
}

function navItem(v: string, label: string, icon: string, on: boolean, href?: string): string {
  return `<a class="nav ${on ? "on" : ""}" href="${href ?? `/admin?view=${encodeURIComponent(v)}`}"><span class="d">${icon}</span>${esc(label)}</a>`;
}

// Origin used to build the absolute invite URL displayed to the admin.
// Falls back to getklar.org for the prod default.
function originFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "getklar.org";
  return `${proto}://${host}`;
}

function settingsCardHtml(s: AdminSettings, msg: string | null): string {
  // Plain HTML/CSS form (no client JS). Each section posts the same /admin/settings
  // route — server reads only the fields present in that section's form.
  return `
  ${msg ? `<div class="flash">${esc(msg)}</div>` : ""}

  <section class="card">
    <h3>Globale Einstellungen</h3>
    <form method="POST" action="/admin/settings/save" class="settings-form">
      <input type="hidden" name="section" value="global"/>
      <label class="toggle">
        <input type="checkbox" name="shader_enabled" value="1" ${s.shader_enabled ? "checked" : ""}/>
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span class="toggle-meta">
          <span class="toggle-name">Marketing-Shader (Smoke-BG)</span>
          <span class="toggle-desc">Animation auf getklar.org Homepage. Aus = statischer BG, schneller Load.</span>
        </span>
      </label>
      <label class="toggle">
        <input type="checkbox" name="auto_accept_affiliates" value="1" ${s.auto_accept_affiliates ? "checked" : ""}/>
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span class="toggle-meta">
          <span class="toggle-name">Affiliates automatisch annehmen</span>
          <span class="toggle-desc">Eingehende Inquiries werden direkt approved + Brevo-Mail. Aus = bleibt im Inbox-View für manuellen Approve.</span>
        </span>
      </label>
      <div class="form-foot">
        <button type="submit" class="btn primary">Speichern</button>
      </div>
    </form>
  </section>

  <section class="card">
    <h3>Benachrichtigungen</h3>
    <p class="card-sub">Wann + wie oft du eine Email zu Inbox-Events bekommst.</p>
    <form method="POST" action="/admin/settings/save" class="settings-form">
      <input type="hidden" name="section" value="notif"/>
      <fieldset class="fieldset">
        <legend class="legend">Trigger</legend>
        <label class="toggle">
          <input type="checkbox" name="notification_trigger_inquiry" value="1" ${s.notification_trigger_inquiry ? "checked" : ""}/>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
          <span class="toggle-meta">
            <span class="toggle-name">Neue Inquiry</span>
            <span class="toggle-desc">Wenn jemand das Affiliate-Bewerbungsform ausfüllt.</span>
          </span>
        </label>
        <label class="toggle">
          <input type="checkbox" name="notification_trigger_complete" value="1" ${s.notification_trigger_complete ? "checked" : ""}/>
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
          <span class="toggle-meta">
            <span class="toggle-name">Setup abgeschlossen</span>
            <span class="toggle-desc">Wenn ein eingeladener Influencer den /affiliate/[token] Apply-Flow durchgeklickt hat.</span>
          </span>
        </label>
      </fieldset>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Batch-Grösse</span>
          <select name="notification_batch_size" class="select">
            ${[1, 5, 10, 25, 50, 100]
              .map(
                (n) =>
                  `<option value="${n}" ${s.notification_batch_size === n ? "selected" : ""}>${n === 1 ? "Sofort (jedes Event)" : `Alle ${n} Events`}</option>`,
              )
              .join("")}
          </select>
          <span class="field-help">Wieviele Events sammeln bevor eine Digest-Mail rausgeht.</span>
        </label>
        <label class="field">
          <span class="field-label">Empfänger</span>
          <input
            type="email"
            name="notification_recipient_email"
            class="input"
            required
            value="${esc(s.notification_recipient_email)}"
          />
          <span class="field-help">Email-Adresse die die Digest bekommt.</span>
        </label>
      </div>
      <div class="form-foot">
        <button type="submit" class="btn primary">Speichern</button>
      </div>
    </form>
  </section>
  `;
}

function invitesCardHtml(invites: AdminInvite[], origin: string): string {
  const rows = invites.length === 0
    ? `<tr><td colspan="4" class="empty">Noch keine Invites generiert.</td></tr>`
    : invites
        .map((inv) => {
          const expired = new Date(inv.expires_at).getTime() < Date.now();
          const status = inv.used_at
            ? `<span class="badge badge-used">eingelöst</span>`
            : expired
              ? `<span class="badge badge-expired">abgelaufen</span>`
              : `<span class="badge badge-open">offen</span>`;
          const url = `${origin}/admin/login?invite=${encodeURIComponent(inv.token)}`;
          return `
          <tr>
            <td><div class="invite-name">${esc(inv.invited_name || "—")}</div><div class="invite-mail">${esc(inv.invited_email || "")}</div></td>
            <td><code class="invite-url">${esc(url)}</code></td>
            <td>${esc(new Date(inv.expires_at).toLocaleDateString("de-CH"))}</td>
            <td>${status}</td>
          </tr>`;
        })
        .join("");

  return `
  <section class="card">
    <h3>Zugriff · neue Person einladen</h3>
    <p class="card-sub">Erstellt einen Einmal-Link der ein neues Gerät ohne Admin-Key registriert. TOTP-Secret muss separat (z.B. via signal) geteilt werden — der Link allein reicht nicht.</p>
    <form method="POST" action="/admin/invite" class="settings-form invite-form">
      <div class="field-row">
        <label class="field">
          <span class="field-label">Name (optional)</span>
          <input type="text" name="name" class="input" maxlength="60" placeholder="z.B. Lukas"/>
        </label>
        <label class="field">
          <span class="field-label">Email (optional)</span>
          <input type="email" name="email" class="input" placeholder="lukas@example.com"/>
        </label>
        <label class="field" style="flex:0 0 140px">
          <span class="field-label">Gültig</span>
          <select name="ttl_days" class="select">
            <option value="1">1 Tag</option>
            <option value="3">3 Tage</option>
            <option value="7" selected>7 Tage</option>
            <option value="30">30 Tage</option>
          </select>
        </label>
      </div>
      <div class="form-foot">
        <button type="submit" class="btn primary">Invite-Link erzeugen</button>
      </div>
    </form>

    <table class="invite-table">
      <thead><tr><th>Eingeladen</th><th>URL</th><th>Läuft ab</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  `;
}

// Local style additions on top of STYLE — toggles, fieldsets, table, flash.
const SETTINGS_STYLE = `
.flash{background:var(--surface-2);border:1px solid var(--line);color:var(--fg-2);padding:10px 14px;border-radius:var(--radius-sm);font-size:13.5px;margin:0 0 22px}
.flash[data-tone="err"]{border-color:#fca5a5;color:#991b1b;background:#fef2f2}
[data-theme="dark"] .flash[data-tone="err"]{border-color:#7f1d1d;background:#450a0a;color:#fecaca}

.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:22px 24px;margin:0 0 22px;box-shadow:var(--shadow-sm)}
.card h3{font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:-.01em;margin:0 0 4px;color:var(--fg)}
.card-sub{font-family:var(--font-editorial);font-style:italic;font-size:14px;color:var(--fg-3);margin:0 0 18px;max-width:62ch}

.settings-form{display:flex;flex-direction:column;gap:16px}

.toggle{display:flex;gap:14px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface-2);cursor:pointer;transition:border-color .15s,background .15s}
.toggle:hover{border-color:var(--line-strong);background:var(--surface-3)}
.toggle input{position:absolute;opacity:0;pointer-events:none}
.toggle-track{flex:0 0 36px;width:36px;height:20px;background:var(--line-strong);border-radius:999px;position:relative;transition:background .18s ease;margin-top:2px}
.toggle-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;background:var(--surface);border-radius:50%;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.toggle input:checked + .toggle-track{background:var(--accent)}
.toggle input:checked + .toggle-track .toggle-thumb{left:18px}
.toggle input:focus-visible + .toggle-track{outline:2px solid var(--info);outline-offset:2px}
.toggle-meta{display:flex;flex-direction:column;gap:3px;min-width:0}
.toggle-name{font-family:var(--font-body);font-size:14px;font-weight:600;color:var(--fg)}
.toggle-desc{font-family:var(--font-body);font-size:12.5px;color:var(--fg-3);line-height:1.45}

.fieldset{border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px 16px;margin:0;display:flex;flex-direction:column;gap:10px}
.legend{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-3);padding:0 6px}

.field-row{display:flex;flex-wrap:wrap;gap:14px}
.field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:200px}
.field-label{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3)}
.field-help{font-size:12px;color:var(--fg-4);line-height:1.45}

.input,.select{font-family:var(--font-body);font-size:14px;padding:9px 12px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);color:var(--fg);transition:border-color .15s,box-shadow .15s}
.input:hover,.select:hover{border-color:var(--line-strong)}
.input:focus,.select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in oklab,var(--accent) 18%,transparent)}

.form-foot{display:flex;justify-content:flex-end;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--surface);color:var(--fg);font-family:var(--font-body);font-size:13.5px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.btn:hover{background:var(--surface-2);border-color:var(--line-strong)}
.btn.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.btn.primary:hover{opacity:.92}

.invite-table{width:100%;margin-top:22px;border-collapse:collapse;font-size:13px}
.invite-table th{text-align:left;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-4);padding:8px 10px;border-bottom:1px solid var(--line)}
.invite-table td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.invite-table tr:last-child td{border-bottom:none}
.invite-table td.empty{text-align:center;color:var(--fg-4);font-style:italic;padding:18px 10px}
.invite-name{font-weight:600;color:var(--fg)}
.invite-mail{font-size:12px;color:var(--fg-4)}
.invite-url{display:inline-block;font-family:var(--font-mono);font-size:11.5px;background:var(--surface-2);padding:4px 8px;border-radius:4px;color:var(--fg-2);word-break:break-all;max-width:340px}

.badge{display:inline-block;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px}
.badge-open{background:#dcfce7;color:#166534}
.badge-expired{background:#fee2e2;color:#991b1b}
.badge-used{background:var(--surface-2);color:var(--fg-3)}
[data-theme="dark"] .badge-open{background:#052e16;color:#bbf7d0}
[data-theme="dark"] .badge-expired{background:#450a0a;color:#fecaca}

.invite-form{margin-bottom:10px}
`;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  // Auth — same gate as /admin and /admin/analytics.
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const deviceRaw = readCookieFromString(cookieHeader, "klar_device");
  const device = await verifyDeviceCookie(deviceRaw, DEV);
  if (!device) redirect("/admin/login");
  const session = readCookieFromString(cookieHeader, "klar_admin");
  if (session !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const [settings, invites] = await Promise.all([
    getAdminSettings(),
    listInvites(),
  ]);
  const origin = originFromHeaders(h);

  // Flash bubble. err= shown with danger styling, msg= neutral.
  const flashRaw = sp.err ?? sp.msg ?? null;
  const flashTone = sp.err ? "err" : "ok";

  const sidebar = `
    <a class="brand" href="/admin?view=overview" aria-label="Klar Control Home">
      <span class="brand-mark"><img src="/logo/klar-symbol.png" alt="" width="40" height="40"/></span>
      <span class="brand-text"><span class="brand-name">Klar</span><span class="brand-sub">Control</span></span>
    </a>
    <div class="navsec">Studio</div>
    ${navItem("overview", "Übersicht", ICON.overview, false)}
    ${navItem("inbox", "Inbox", ICON.inbox, false)}
    ${navItem("bookings", "Bookings", ICON.calendar, false)}
    ${navItem("cal", "Cal Admin", ICON.calendar, false)}
    ${navItem("analytics", "Analytics", ICON.analytics, false, "/admin/analytics")}
    <div class="navsec">Affiliate</div>
    ${navItem("revenue", "Einnahmen", ICON.revenue, false)}
    ${appLinks() || `<span class="nav muted"><span class="d">${ICON.app}</span>keine Apps</span>`}
    <div class="navsec">Extern</div>
    ${navItem("outreach", "Outreach", ICON.outreach, false)}
    <a class="nav" href="https://cal.getklar.org" target="_blank" rel="noopener"><span class="d">${ICON.calendar}</span>Cal in neuem Tab <span style="margin-left:auto;font-size:10px;opacity:.6">↗</span></a>
    <div class="spacer"></div>
    ${navItem("settings", "Einstellungen", ICON.lock, true, "/admin/settings")}
    <a class="nav logout" href="/admin/logout"><span class="d">${ICON.logout}</span>Logout</a>
  `;

  const topbar = `
    <span class="crumb"><b>Einstellungen</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  const flash = flashRaw
    ? `<div class="flash" data-tone="${flashTone}">${esc(flashRaw)}</div>`
    : "";

  return (
    <>
      <title>Einstellungen · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE + SETTINGS_STYLE }} />
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
            <h1>Einstellungen</h1>
            <p className="sub">
              Globale Schalter für das Klar-Studio — Marketing-Shader, Auto-Accept
              für Affiliate-Inquiries, Benachrichtigungs-Trigger und Einladungen
              für neue Admin-Geräte.
            </p>
            <div dangerouslySetInnerHTML={{ __html: flash + settingsCardHtml(settings, null) + invitesCardHtml(invites, origin) }} />
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
