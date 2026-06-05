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
  adminSidebar,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import {
  getAdminSettings,
  listInvites,
  type AdminSettings,
  type AdminInvite,
} from "../../../lib/adminSettings";
import { listBrainMembers, type BrainMember } from "@/lib/brainMembers";
import { availableFolders, SHOWCASE_FOLDERS, type Group } from "@/lib/brainVault";
import { listTokens, type ApiTokenRow } from "@/lib/apiTokens";
import { listSecrets, type VaultSecretMeta } from "@/lib/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function brainAccessCardHtml(members: BrainMember[], folders: Group[]): string {
  const memberRows = members.length === 0
    ? `<tr><td colspan="5" class="empty">Noch keine Brain-Mitglieder.</td></tr>`
    : members
        .map((m) => {
          const revoked = Boolean(m.revoked_at);
          const clearanceBadge =
            m.clearance === "full"
              ? `<span class="badge badge-full">voll</span>`
              : `<span class="badge badge-used">${m.folders.length} Bereiche</span>`;
          const status = revoked
            ? `<span class="badge badge-expired">entzogen</span>`
            : `<span class="badge badge-open">aktiv</span>`;
          const seen = m.last_seen_at
            ? new Date(m.last_seen_at).toLocaleDateString("de-CH")
            : "—";
          const scope = m.clearance === "full" ? "voller Zugriff" : m.folders.join(", ");
          const action = revoked
            ? ""
            : `<form method="POST" action="/admin/brain-invite" style="display:inline">
                 <input type="hidden" name="action" value="revoke"/>
                 <input type="hidden" name="email" value="${esc(m.email)}"/>
                 <button type="submit" class="btn" style="padding:5px 10px;font-size:12px">Entziehen</button>
               </form>`;
          return `
          <tr>
            <td><div class="invite-name">${esc(m.email)}</div><div class="invite-mail">${esc(scope)}</div></td>
            <td>${clearanceBadge}</td>
            <td>${esc(seen)}</td>
            <td>${status}</td>
            <td>${action}</td>
          </tr>`;
        })
        .join("");

  const checks = folders
    .map((f) => {
      const checked = SHOWCASE_FOLDERS.includes(f.key) ? "checked" : "";
      return `<label class="chk">
        <input type="checkbox" name="folders" value="${esc(f.key)}" ${checked}/>
        <span class="dot" style="background:${esc(f.color)}"></span>${esc(f.label)} <span style="color:var(--fg-4)">(${f.count})</span>
      </label>`;
    })
    .join("");

  return `
  <section class="card">
    <h3>AI-Brain · Zugriff</h3>
    <p class="card-sub">Lade jemanden ein, das AI-Brain unter /brain zu lesen. Clearance "Voll" = alle Bereiche (ausser Secrets), "Nur Bereiche" = nur die ausgewählten Ordner. Die Person meldet sich danach selbst per Magic-Link unter /brain/login an.</p>
    <form method="POST" action="/admin/brain-invite" class="settings-form invite-form">
      <input type="hidden" name="action" value="invite"/>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Email</span>
          <input type="email" name="email" class="input" required placeholder="person@example.com"/>
        </label>
        <label class="field" style="flex:0 0 200px">
          <span class="field-label">Clearance</span>
          <select name="clearance" class="select">
            <option value="brain">Nur Bereiche</option>
            <option value="full">Voll (alle Ordner)</option>
          </select>
        </label>
      </div>
      <div class="field">
        <span class="field-label">Bereiche (bei Clearance "Nur Bereiche")</span>
        <div class="chk-grid">${checks}</div>
      </div>
      <div class="form-foot">
        <button type="submit" class="btn primary">Zugang erstellen</button>
      </div>
    </form>

    <table class="invite-table">
      <thead><tr><th>Mitglied</th><th>Clearance</th><th>Zuletzt</th><th>Status</th><th></th></tr></thead>
      <tbody>${memberRows}</tbody>
    </table>
  </section>
  `;
}

function tokensCardHtml(tokens: ApiTokenRow[]): string {
  const rows = tokens.length === 0
    ? `<tr><td colspan="5" class="empty">Noch keine Tokens.</td></tr>`
    : tokens
        .map((t) => {
          const revoked = Boolean(t.revoked_at);
          const status = revoked
            ? `<span class="badge badge-expired">entzogen</span>`
            : `<span class="badge badge-open">aktiv</span>`;
          const last = t.last_used_at
            ? new Date(t.last_used_at).toLocaleDateString("de-CH")
            : "—";
          const action = revoked
            ? ""
            : `<form method="POST" action="/admin/tokens" style="display:inline" data-klar-confirm="Token wird sofort ungültig. Geräte mit diesem Token verlieren den Zugriff." data-klar-confirm-title="Token widerrufen?" data-klar-confirm-variant="danger" data-klar-confirm-ok="Widerrufen">
                 <input type="hidden" name="action" value="revoke"/>
                 <input type="hidden" name="id" value="${esc(t.id)}"/>
                 <button type="submit" class="btn" style="padding:5px 10px;font-size:12px">Widerrufen</button>
               </form>`;
          return `<tr>
            <td><div class="invite-name">${esc(t.label)}</div><div class="invite-mail" style="font-family:var(--font-mono)">${esc(t.prefix)}…</div></td>
            <td>${t.scopes.map((s) => `<span class="badge badge-used">${esc(s)}</span>`).join(" ")}</td>
            <td>${esc(last)}</td>
            <td>${status}</td>
            <td>${action}</td>
          </tr>`;
        })
        .join("");
  return `
  <section class="card">
    <h3>API-Tokens</h3>
    <p class="card-sub">Zugänge für Remote-Agents (Brain-API V2) und den künftigen Vault. Der Token wird nur einmal angezeigt und nur gehasht gespeichert — Widerruf jederzeit.</p>
    <form method="POST" action="/admin/tokens" class="settings-form invite-form">
      <input type="hidden" name="action" value="create"/>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Label</span>
          <input type="text" name="label" class="input" maxlength="80" placeholder="z.B. MacBook · Claude Code"/>
        </label>
      </div>
      <div class="field">
        <span class="field-label">Scopes</span>
        <div class="chk-grid">
          <label class="chk"><input type="checkbox" name="scope_brain" checked/> brain:read</label>
          <label class="chk"><input type="checkbox" name="scope_vault"/> vault:use</label>
        </div>
      </div>
      <div class="form-foot"><button type="submit" class="btn primary">Token erzeugen</button></div>
    </form>
    <table class="invite-table">
      <thead><tr><th>Token</th><th>Scopes</th><th>Zuletzt</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  `;
}

function vaultCardHtml(secrets: VaultSecretMeta[], origin: string): string {
  const rows = secrets.length === 0
    ? `<tr><td colspan="4" class="empty">Noch keine Keys im Vault.</td></tr>`
    : secrets
        .map((s) => {
          const proxy = `${origin}/api/vault/proxy/${s.id}/`;
          return `<tr>
            <td><div class="invite-name">${esc(s.label)}</div><div class="invite-mail">${esc(s.provider)} · ${esc(s.base_url)}</div></td>
            <td><code class="invite-url">${esc(proxy)}…</code></td>
            <td>${s.last_used_at ? esc(new Date(s.last_used_at).toLocaleDateString("de-CH")) : "—"}</td>
            <td><form method="POST" action="/admin/vault" style="display:inline" data-klar-confirm="Key wird endgültig gelöscht. Agents verlieren den Zugriff darauf." data-klar-confirm-title="Vault-Key löschen?" data-klar-confirm-variant="danger" data-klar-confirm-ok="Löschen">
              <input type="hidden" name="action" value="delete"/>
              <input type="hidden" name="id" value="${esc(s.id)}"/>
              <button type="submit" class="btn" style="padding:5px 10px;font-size:12px">Löschen</button>
            </form></td>
          </tr>`;
        })
        .join("");
  return `
  <section class="card">
    <h3>API-Key Vault</h3>
    <p class="card-sub">Keys werden AES-256-GCM verschlüsselt gespeichert (Master-Key nur in Vercel-Env). Ein Agent mit <code>vault:use</code>-Token nutzt sie über den Proxy, ohne sie je zu sehen. Aufruf: <code>&lt;Proxy-URL&gt;&lt;Provider-Pfad&gt;</code> mit <code>Authorization: Bearer &lt;token&gt;</code>.</p>
    <form method="POST" action="/admin/vault" class="settings-form invite-form" autocomplete="off">
      <input type="hidden" name="action" value="add"/>
      <div class="field-row">
        <label class="field"><span class="field-label">Label</span><input type="text" name="label" class="input" maxlength="80" placeholder="z.B. OpenAI Prod" required/></label>
        <label class="field" style="flex:0 0 140px"><span class="field-label">Provider</span><input type="text" name="provider" class="input" maxlength="40" placeholder="openai"/></label>
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">Base-URL</span><input type="url" name="base_url" class="input" placeholder="https://api.openai.com" required/></label>
      </div>
      <div class="field-row">
        <label class="field" style="flex:0 0 200px"><span class="field-label">Auth-Header</span><input type="text" name="auth_header" class="input" value="authorization"/></label>
        <label class="field" style="flex:0 0 140px"><span class="field-label">Schema-Prefix</span><input type="text" name="auth_scheme" class="input" value="Bearer "/></label>
      </div>
      <div class="field">
        <span class="field-label">API-Key (wird verschlüsselt, nur einmal hier eingeben)</span>
        <input type="password" name="secret" class="input" autocomplete="new-password" required placeholder="sk-…"/>
      </div>
      <div class="form-foot"><button type="submit" class="btn primary">Key verschlüsselt speichern</button></div>
    </form>
    <table class="invite-table">
      <thead><tr><th>Key</th><th>Proxy-URL</th><th>Zuletzt</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  `;
}

// Local style additions on top of STYLE — toggles, fieldsets, table, flash.
const SETTINGS_STYLE = `
.flash{background:var(--surface-2);border:1px solid var(--line);color:var(--fg-2);padding:10px 14px;border-radius:var(--radius-sm);font-size:13.5px;margin:0 0 22px}
.flash[data-tone="err"]{border-color:color-mix(in oklab,var(--danger) 35%,var(--line));background:color-mix(in oklab,var(--danger) 10%,var(--surface));color:var(--danger)}

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

.badge{display:inline-block;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px;border:1px solid transparent}
.badge-open{background:color-mix(in oklab,var(--success) 14%,transparent);color:var(--success);border-color:color-mix(in oklab,var(--success) 30%,transparent)}
.badge-expired{background:color-mix(in oklab,var(--danger) 14%,transparent);color:var(--danger);border-color:color-mix(in oklab,var(--danger) 30%,transparent)}
.badge-used{background:var(--surface-2);color:var(--fg-3);border-color:var(--line)}

.invite-form{margin-bottom:10px}

.chk-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
.chk{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);font-size:12.5px;color:var(--fg-2);cursor:pointer;transition:border-color .15s}
.chk:hover{border-color:var(--line-strong)}
.chk input{accent-color:var(--accent)}
.chk .dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}
.badge-full{background:var(--surface-3);color:var(--fg-2);border-color:var(--line-strong)}
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
  const [settings, invites, brainMembers, tokens, vaultSecrets] = await Promise.all([
    getAdminSettings(),
    listInvites(),
    listBrainMembers(),
    listTokens(),
    listSecrets(),
  ]);
  const brainFolders = availableFolders();
  const origin = originFromHeaders(h);

  // Flash bubble. err= shown with danger styling, msg= neutral.
  const flashRaw = sp.err ?? sp.msg ?? null;
  const flashTone = sp.err ? "err" : "ok";

  const sidebar = adminSidebar("settings", getApps());

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
            <div dangerouslySetInnerHTML={{ __html: flash + settingsCardHtml(settings, null) + tokensCardHtml(tokens) + vaultCardHtml(vaultSecrets, origin) + brainAccessCardHtml(brainMembers, brainFolders) + invitesCardHtml(invites, origin) }} />
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
