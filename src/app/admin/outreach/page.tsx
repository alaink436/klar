// Klar Control · Outreach — influencer outreach tracker + wave starter.
//
// Server component. Reads klar_outreach_targets / runs / suppressions + live
// Apify + Brevo quota, renders the wave-starter, run history, per-app buckets,
// target table and suppression list. Same chrome + 2FA gate as the rest of
// /admin, plus confirm-modal infra (data-klar-confirm). Inner content is an
// HTML string injected into .content; the add-form + wave-form <script>s plus
// the auto-refresh <meta> are rendered as top-level elements since innerHTML
// scripts/meta don't run/hoist. Reply handling lives in /admin/replies.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET, KLAR_INBOX_SERVICE_KEY
//      (+ APIFY_API_TOKEN, BREVO_API_KEY for the live quota cards).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  MODAL_HTML,
  MODAL_SCRIPT,
  readCookieFromString,
  adminSidebar,
  esc,
  fmtRelative,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps } from "../../../lib/adminApps";
import {
  getOutreachStats,
  listOutreachTargets,
  listOutreachRuns,
  getOutreachCostSummary,
  listSuppressions,
  isOutreachConfigured,
  type OutreachPlatform,
  type OutreachStatus,
  type OutreachTarget,
  type OutreachRun,
  type SuppressionRow,
} from "../../../lib/outreachStore";
import { getApifyAccountStatus } from "../../../lib/apifyAccount";
import { getBrevoQuota } from "../../../lib/brevoQuota";
import { KLAR_APPS } from "../../../lib/klarApps";
import OutreachKpis, { type OutreachStatsLite } from "./OutreachKpis";
import OutreachFilters, { type OutreachFilterState } from "./OutreachFilters";
import OutreachRuns, { type RunRowData, type RunBadgeTone } from "./OutreachRuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Quiet-Pill (mirrors route.ts): one neutral surface tone, colour only as
// restrained text tinting via tokens. Kept local to this route.
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

const STATUS_LABEL: Record<OutreachStatus, string> = {
  queued: "Queued",
  dm_sent: "DM gesendet",
  replied: "Geantwortet",
  declined: "Abgelehnt",
  converted: "Converted",
  dead: "Dead",
};
function statusPill(s: OutreachStatus): string {
  const tone: PillTone =
    s === "converted" ? "success"
    : s === "replied" ? "warning"
    : s === "dm_sent" ? "info"
    : "neutral";
  return quietPill(STATUS_LABEL[s], tone);
}
const PLATFORM_LABEL: Record<OutreachPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
};
function fmtFollowers(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}
const TARGET_STATUS_ORDER: OutreachStatus[] = [
  "queued", "dm_sent", "replied", "converted", "declined", "dead",
];
function fmtBigNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}
// Heuristik: Outreach-Target stammt aus internem Self-Test.
const isTestTarget = (t: OutreachTarget): boolean => {
  const h = (t.handle ?? "").toLowerCase();
  const e = (t.contact_email ?? "").toLowerCase();
  if (e === "alainkessler04@gmail.com") return true;
  if (h.includes("selftest") || h === "klar_test" || h.startsWith("klar_s")) return true;
  return false;
};

// Add-Target-Form client JS (was inline in the form). Rendered as a top-level
// <script> element so it executes (innerHTML-injected scripts don't run).
const ADD_FORM_JS = `
(function(){
  var f = document.getElementById('outreach-add-form');
  if (!f) return;
  f.addEventListener('submit', function(){
    var picks = Array.from(f.querySelectorAll('input[type=checkbox][name^="for_apps_"]:checked')).map(function(c){return c.value;});
    document.getElementById('for-apps-hidden').value = picks.join(',');
  });
})();
`;

// Wave-starter client JS: cost calculator + per-app/lang template loader +
// cost-confirm submit guard. Rendered as a top-level <script> element.
const WAVE_FORM_JS = `
(function(){
  var f = document.getElementById('wave-form');
  if (!f) return;
  var display = document.getElementById('wave-cost-display');
  var tplStatus = document.getElementById('wave-template-status');
  var mailDetails = document.getElementById('wave-mail-details');
  var mailSummary = document.getElementById('wave-mail-summary');
  var countDisplay = document.getElementById('wave-count-display');
  var subjectInput = f.querySelector('input[name="mail_subject"]');
  var bodyInput = f.querySelector('textarea[name="mail_body"]');
  var initialSubject = subjectInput ? subjectInput.value : '';
  var initialBody = bodyInput ? bodyInput.value : '';
  var lastLoadedKey = '';
  var mailDirty = false;

  function calc(){
    var apps = f.querySelectorAll('input.wave-app-chk:checked').length;
    var igChecked = !!f.querySelector('input.wave-plat-chk[value="instagram"]:checked');
    var ttChecked = !!f.querySelector('input.wave-plat-chk[value="tiktok"]:checked');
    var plats = (igChecked?1:0) + (ttChecked?1:0);
    var n = parseInt((f.querySelector('input[name="count_per_app"]')||{}).value || '0', 10) || 0;
    var langs = Math.max(1, f.querySelectorAll('input.wave-lang-chk:checked').length);
    if (countDisplay) countDisplay.textContent = String(n);
    var total = apps * langs * plats * n;
    if (total === 0) { display.textContent = '— Apps + Plattformen wählen'; return; }
    // Apify pricing 2026-05 (live-verified): IG $0.0023/item, TikTok FLAT $45/mo rental + compute.
    // Post-S41 scrape caps in n8n: IG-Hashtag.resultsLimit = ceil(n*1.2) max 30 (smallBucket 1.8/45),
    // IG-Profile.resultsLimit = 1 per username, TT.resultsPerPage = min(n+5, 25).
    var buckets = Array.from(f.querySelectorAll('input.wave-size-chk:checked')).map(function(c){return c.value;});
    var smallBucket = buckets.length > 0 && buckets.every(function(b){ return b === 'nano' || b === 'micro'; });
    var scrape = smallBucket ? Math.min(Math.ceil(n*1.8), 45) : Math.min(Math.ceil(n*1.2), 30);
    var igUsd = igChecked ? (scrape * 0.0023 + Math.ceil(scrape * 0.7) * 0.0023) : 0;
    var ttUsd = ttChecked ? 0.30 : 0;  // compute only; $45/mo rental shown account-wide
    var usdPerWave = igUsd + ttUsd;
    var usd = apps * langs * usdPerWave;
    var waves = apps * langs;
    window.__waveCostUsd = usd;  // submit-handler reads this for confirm-dialog
    var smallNote = smallBucket ? ' <span class="muted" style="font-size:10px">(scrape '+scrape+')</span>' : '';
    var langNote = langs > 1 ? ' <span class="muted" style="font-size:10px">(' + apps + ' App × ' + langs + ' Region)</span>' : '';
    display.innerHTML = waves + ' Wellen · ~' + total.toLocaleString() + ' Profile · <strong>≈ $' + usd.toFixed(2) + '</strong> Apify' + smallNote + langNote;
  }

  function updateMailSummary(){
    if (!mailSummary || !subjectInput || !bodyInput) return;
    if (mailDirty) {
      mailSummary.textContent = '✎ custom override aktiv';
    } else if (mailDetails && mailDetails.open) {
      mailSummary.textContent = 'geöffnet — nicht editiert';
    } else {
      mailSummary.textContent = 'geschlossen = App-Default';
    }
  }

  function loadTemplate(){
    var pickedApps = Array.from(f.querySelectorAll('input.wave-app-chk:checked')).map(function(c){return c.value;});
    var pickedLangs = Array.from(f.querySelectorAll('input.wave-lang-chk:checked')).map(function(c){return c.value;});
    if (!subjectInput || !bodyInput) return;
    if (pickedApps.length !== 1 || pickedLangs.length !== 1) {
      if (tplStatus) {
        if (pickedApps.length === 0) tplStatus.textContent = '';
        else if (pickedApps.length > 1 && pickedLangs.length > 1) tplStatus.textContent = '⚠️ ' + pickedApps.length + ' App × ' + pickedLangs.length + ' Region = ' + (pickedApps.length * pickedLangs.length) + ' Wellen, jede zieht ihr eigenes DB-Template (ausser du bearbeitest Subject/Body hier)';
        else if (pickedApps.length > 1) tplStatus.textContent = '⚠️ Multi-App: jede App nutzt ihr eigenes DB-Template (ausser du bearbeitest Subject/Body hier)';
        else tplStatus.textContent = '⚠️ Multi-Region: jede Region zieht ihr eigenes DB-Template (ausser du bearbeitest Subject/Body hier)';
      }
      return;
    }
    var app = pickedApps[0];
    var lang = pickedLangs[0];
    var key = app + '|' + lang;
    if (key === lastLoadedKey) return;
    if (tplStatus) tplStatus.textContent = '⏳ lade Template ' + app + '/' + lang + '…';
    fetch('/admin/templates/get?app=' + encodeURIComponent(app) + '&language=' + encodeURIComponent(lang), { credentials: 'same-origin' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(tpl){
        if (!tpl) {
          if (tplStatus) tplStatus.textContent = '⚠️ Kein Template für ' + app + '/' + lang;
          return;
        }
        if (!mailDirty) {
          if (tpl.mail1_subject) { subjectInput.value = tpl.mail1_subject; initialSubject = tpl.mail1_subject; }
          if (tpl.mail1_body) { bodyInput.value = tpl.mail1_body; initialBody = tpl.mail1_body; }
        }
        lastLoadedKey = key;
        if (tplStatus) tplStatus.innerHTML = '✓ Template <strong>' + app + '/' + lang + '</strong> geladen' + (tpl.mail1_subject ? '' : ' (Subject leer)');
      })
      .catch(function(e){
        if (tplStatus) tplStatus.textContent = '⚠️ Template-Load fehlgeschlagen: ' + e.message;
      });
  }

  // Track mail edits so we know whether to overwrite on app change.
  function markDirty(){
    if (!subjectInput || !bodyInput) return;
    mailDirty = (subjectInput.value !== initialSubject) || (bodyInput.value !== initialBody);
    updateMailSummary();
  }
  if (subjectInput) subjectInput.addEventListener('input', markDirty);
  if (bodyInput) bodyInput.addEventListener('input', markDirty);
  if (mailDetails) mailDetails.addEventListener('toggle', updateMailSummary);

  f.addEventListener('change', function(ev){
    calc();
    if (ev.target && ev.target.classList && (ev.target.classList.contains('wave-app-chk') || ev.target.classList.contains('wave-lang-chk'))) loadTemplate();
  });
  f.addEventListener('input', calc);
  // Cost-confirm guard. Server-side mirror in start/route.ts rejects
  // submits >= $2 without cost_confirmed=1, so we always set the hidden
  // field when the admin clicks through the confirm-dialog.
  f.addEventListener('submit', function(ev){
    var usd = window.__waveCostUsd || 0;
    var hidden = f.querySelector('input[name="cost_confirmed"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'cost_confirmed';
      f.appendChild(hidden);
    }
    if (usd >= 2.00) {
      if (f.dataset.klarConfirmed === '1') {
        f.dataset.klarConfirmed = '';
        hidden.value = '1';
        return; // allow native submit
      }
      ev.preventDefault();
      window.klarConfirm({
        title: 'Welle wirklich starten?',
        body: 'Geschätzter Apify-Spend: $' + usd.toFixed(2) + '. Wird sofort ausgeführt.',
        variant: 'warn',
        confirmText: 'Welle starten',
      }).then(function(ok){
        if (ok) { hidden.value = '1'; f.dataset.klarConfirmed = '1'; f.requestSubmit ? f.requestSubmit() : f.submit(); }
      });
      return;
    } else {
      hidden.value = '';
    }
  });
  calc();
  updateMailSummary();
})();
`;

type OutreachMainResult =
  | { configured: false; html: string }
  | {
      configured: true;
      topHtml: string;
      midTopHtml: string;
      runs: RunRowData[];
      hasRunningWave: boolean;
      midBotHtml: string;
      bottomHtml: string;
      stats: OutreachStatsLite;
      filter: OutreachFilterState;
    };

async function outreachMain(
  filterPlatform: string,
  filterStatus: string,
  filterApp: string,
  query: string,
  autoRefresh: boolean,
  showTests: boolean,
): Promise<OutreachMainResult> {
  if (!isOutreachConfigured()) {
    return { configured: false, html: `<h1>Outreach</h1><p class="sub muted">Outreach-Tracker braucht <span class="warn">KLAR_INBOX_SERVICE_KEY</span> in Vercel (anime-vault Service-Role). Tabelle <code>klar_outreach_targets</code> ist via Migration <code>klar_outreach_targets_v1</code> + <code>v2_metrics</code> angelegt.</p>` };
  }

  const platform = (["tiktok", "instagram"].includes(filterPlatform) ? filterPlatform : "all") as
    | OutreachPlatform | "all";
  const status = (TARGET_STATUS_ORDER as string[]).includes(filterStatus)
    ? (filterStatus as OutreachStatus)
    : "all";
  const app = filterApp && filterApp !== "all" ? filterApp : "all";
  const q = query.trim().slice(0, 80);

  const [stats, rowsRaw, runs, costSummary, allTargets, apifyAccount, brevoQuota, suppressions] = await Promise.all([
    getOutreachStats(),
    listOutreachTargets({ platform, status, app, query: q, limit: 200 }),
    listOutreachRuns(10),
    getOutreachCostSummary(),
    listOutreachTargets({ platform: "all", status: "all", app: "all", limit: 500 }),
    getApifyAccountStatus(),
    getBrevoQuota(),
    listSuppressions(20),
  ]);
  // Test-Targets standardmäßig ausblenden, mit Toggle. Counter zählt aus
  // dem aktuell geladenen Subset (rowsRaw), nicht aus allTargets — sonst
  // verwirrt die Zahl wenn ein anderer Filter aktiv ist.
  const nTests = rowsRaw.filter(isTestTarget).length;
  const rows = showTests ? rowsRaw : rowsRaw.filter((t) => !isTestTarget(t));

  // KPI cards + filter strip now render as shadcn React components
  // (OutreachKpis / OutreachFilters) in the page; only the data is computed here.
  const statusOptions = TARGET_STATUS_ORDER.map((s) => ({ value: s as string, label: STATUS_LABEL[s] }));
  const testsToggleHref = (() => {
    const parts: string[] = ["view=outreach"];
    if (platform !== "all") parts.push(`p=${encodeURIComponent(platform)}`);
    if (status !== "all") parts.push(`s=${encodeURIComponent(status)}`);
    if (app !== "all") parts.push(`a=${encodeURIComponent(app)}`);
    if (q) parts.push(`q=${encodeURIComponent(q)}`);
    if (autoRefresh) parts.push("ar=1");
    if (!showTests) parts.push("show_tests=1");
    return `/admin?${parts.join("&")}`;
  })();
  const testsToggle = nTests > 0
    ? `<div style="margin:0 0 14px;padding:10px 14px;background:var(--surface-2);border:1px dashed var(--line);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span class="muted" style="font-size:12px;font-family:var(--font-mono);letter-spacing:.04em">${showTests ? "⚙" : "•"} ${nTests} Test-Target${nTests === 1 ? "" : "s"}${showTests ? " (eingeblendet)" : " (versteckt)"}</span>
        <a class="applink" href="${testsToggleHref}" style="font-size:12px">${showTests ? "verstecken" : "zeigen"} →</a>
      </div>`
    : "";
  const appOptions = ["all", ...KLAR_APPS.map((a) => a.slug)];

  // Add-Target-Form
  const appCheckboxes = KLAR_APPS
    .map((a) => `<label style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--surface-2);border:1px solid var(--line);border-radius:6px;font-size:12px;cursor:pointer">
      <input type="checkbox" name="for_apps_${a.slug}" value="${esc(a.slug)}" style="margin:0"/>${esc(a.name)}
    </label>`).join("");

  const addForm = `<details style="background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 18px;margin-bottom:24px">
    <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--fg-2);user-select:none">+ Target hinzufügen</summary>
    <form method="POST" action="/admin/outreach/add" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:16px" id="outreach-add-form">
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Handle*
        <input type="text" name="handle" required maxlength="64" pattern="[A-Za-z0-9_.-]{1,64}" placeholder="marie_knits" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-family:var(--font-mono);font-size:13px"/>
      </label>
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Plattform*
        <select name="platform" required style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px">
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
        </select>
      </label>
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Display-Name
        <input type="text" name="display_name" maxlength="80" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
      </label>
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Profile-URL
        <input type="url" name="profile_url" maxlength="500" placeholder="https://tiktok.com/@..." style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
      </label>
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Follower (est.)
        <input type="number" name="follower_estimate" min="0" max="100000000" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
      </label>
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Niche
        <input type="text" name="niche" maxlength="80" placeholder="yarn, fitness, moto..." style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
      </label>
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Sprache
        <select name="language" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px">
          <option value="de">de</option><option value="en">en</option><option value="fr">fr</option><option value="es">es</option><option value="it">it</option>
        </select>
      </label>
      <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Priority (1=top)
        <input type="number" name="priority" min="1" max="5" value="3" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
      </label>
      <div style="grid-column:1/-1;display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Passende Apps
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${appCheckboxes}</div>
        <input type="hidden" name="for_apps" value="" id="for-apps-hidden"/>
      </div>
      <label style="grid-column:1/-1;display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Notes
        <textarea name="notes" rows="2" maxlength="1000" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical"></textarea>
      </label>
      <div style="grid-column:1/-1"><button type="submit" class="btn">Target anlegen</button></div>
    </form>
  </details>`;
  // Targets-Tabelle (mit Mail-Counter + Views + Engagement + Edit-Metrics)
  const targetRow = (t: OutreachTarget): string => {
    const profile = t.profile_url
      ? `<a href="${esc(t.profile_url)}" target="_blank" rel="noopener" class="applink">@${esc(t.handle)}</a>`
      : `@${esc(t.handle)}`;
    const apps = (t.for_apps && t.for_apps.length > 0)
      ? t.for_apps.map((a) => `<span class="pill" style="font-size:9px;padding:1px 6px">${esc(a)}</span>`).join(" ")
      : `<span class="muted" style="font-size:11px">—</span>`;

    // Status-Quick-Actions: nur Vorwärts-Pfeile zeigen. Decline wird separat
    // als Klapp-Form mit reason + suppress-checkbox gerendert (s.u.), damit
    // beim Ablehnen direkt die Suppression-Liste mitgepflegt wird.
    const actions: { label: string; status: OutreachStatus }[] = [];
    if (t.status === "queued")  actions.push({ label: "DM ✓", status: "dm_sent" });
    if (t.status === "dm_sent") actions.push(
      { label: "Antwort", status: "replied" },
      { label: "Dead", status: "dead" },
    );
    if (t.status === "replied") actions.push(
      { label: "Converted", status: "converted" },
    );
    const actionForms = actions.map((a) =>
      `<form method="POST" action="/admin/outreach/update" style="display:inline">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <input type="hidden" name="status" value="${esc(a.status)}"/>
        <button type="submit" class="btn ghost" style="padding:4px 9px;font-size:11px">${esc(a.label)}</button>
      </form>`,
    ).join(" ");

    // Mail-Sent counter + Button. Counter clickbar = Inkrement.
    const mailForm = `<form method="POST" action="/admin/outreach/mark-mail" style="display:inline" title="${t.mails_sent} Mail(s) bisher${t.last_mail_at ? `, zuletzt ${fmtRelative(t.last_mail_at)}` : ""}">
      <input type="hidden" name="id" value="${esc(t.id)}"/>
      <button type="submit" class="btn ghost" style="padding:4px 9px;font-size:11px">✉ ${t.mails_sent}</button>
    </form>`;

    // Decline-Klapp-Form: Reason + optional Suppression. Nur für aktive
    // Konversations-Stadien (dm_sent + replied). Modal-Confirm zusätzlich
    // gegen versehentliche Klicks.
    const showDecline = t.status === "dm_sent" || t.status === "replied";
    const declineForm = showDecline
      ? `<details style="display:inline-block;vertical-align:middle">
          <summary style="cursor:pointer;padding:4px 9px;font-size:11px;font-family:var(--font-body);color:var(--fg-3);border:1px solid var(--line);border-radius:6px;user-select:none;list-style:none">Ablehnen</summary>
          <form method="POST" action="/admin/outreach/decline" style="display:flex;gap:6px;align-items:center;margin-top:6px;padding:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;flex-wrap:wrap" data-klar-confirm="Status wird auf 'declined' gesetzt. Bei aktivierter Suppression wird @${esc(t.handle)} in zukünftigen Wellen übersprungen." data-klar-confirm-title="@${esc(t.handle)} ablehnen?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Ablehnen">
            <input type="hidden" name="id" value="${esc(t.id)}"/>
            <input type="text" name="reason" maxlength="280" placeholder="Grund (optional, intern)" style="padding:5px 8px;font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:5px;color:var(--fg);min-width:200px"/>
            <label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--fg-2);cursor:pointer;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em" title="Influencer auf Suppression-Liste setzen">
              <input type="checkbox" name="suppress" value="1" checked style="cursor:pointer"/>
              Suppress
            </label>
            <button type="submit" class="btn ghost" style="padding:5px 11px;font-size:11px">Ablehnen</button>
          </form>
        </details>`
      : "";

    const deleteForm = `<form method="POST" action="/admin/outreach/delete" style="display:inline" data-klar-confirm="Lead wird komplett aus der Outreach-Tabelle entfernt. Falls bereits eine Mail rausging, bleibt die in der Inbox des Influencers." data-klar-confirm-title="@${esc(t.handle)} löschen?" data-klar-confirm-variant="danger" data-klar-confirm-ok="Lead löschen">
      <input type="hidden" name="id" value="${esc(t.id)}"/>
      <button type="submit" class="btn ghost" style="padding:4px 9px;font-size:11px;color:var(--danger)" title="Hard delete">✕</button>
    </form>`;

    return `<tr data-row-id="${esc(t.id)}">
      <td><button type="button" class="btn ghost" onclick="this.closest('tbody').querySelector('[data-edit-for=&quot;${esc(t.id)}&quot;]').style.display=this.closest('tbody').querySelector('[data-edit-for=&quot;${esc(t.id)}&quot;]').style.display==='none'?'table-row':'none';" style="padding:2px 7px;font-size:11px;margin-right:6px" title="Metriken bearbeiten">▸</button>${profile}<div class="muted" style="font-size:11px;margin-top:2px">${esc(t.display_name ?? "")} ${t.niche ? `· ${esc(t.niche)}` : ""}</div></td>
      <td><span class="pill" style="font-size:10px">${esc(PLATFORM_LABEL[t.platform])}</span></td>
      <td class="r">${fmtFollowers(t.follower_estimate)}</td>
      <td class="r"><span title="Total Views">${fmtBigNum(t.total_views_estimate)}</span>${t.avg_views_per_post ? `<div class="muted" style="font-size:10px">Ø ${fmtBigNum(t.avg_views_per_post)}/post</div>` : ""}${t.engagement_rate_pct ? `<div class="muted" style="font-size:10px">${t.engagement_rate_pct}% eng.</div>` : ""}</td>
      <td>${apps}</td>
      <td>${statusPill(t.status)}<div class="muted" style="font-size:10px;margin-top:2px">${fmtRelative(t.updated_at)}</div></td>
      <td class="r" style="white-space:nowrap">${actionForms} ${mailForm} ${declineForm} ${deleteForm}</td>
    </tr>
    <tr data-edit-for="${esc(t.id)}" style="display:none"><td colspan="7" style="padding:8px 14px;background:var(--surface-2)">
      <form method="POST" action="/admin/outreach/update-metrics" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <label style="display:flex;flex-direction:column">Follower
          <input type="number" name="follower_estimate" min="0" max="100000000" value="${t.follower_estimate ?? ""}" style="margin-top:3px;padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px;width:110px"/>
        </label>
        <label style="display:flex;flex-direction:column">Total-Views
          <input type="number" name="total_views_estimate" min="0" max="100000000000" value="${t.total_views_estimate ?? ""}" style="margin-top:3px;padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px;width:130px"/>
        </label>
        <label style="display:flex;flex-direction:column">Ø Views/Post
          <input type="number" name="avg_views_per_post" min="0" max="100000000" value="${t.avg_views_per_post ?? ""}" style="margin-top:3px;padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px;width:110px"/>
        </label>
        <label style="display:flex;flex-direction:column">Engagement %
          <input type="number" name="engagement_rate_pct" min="0" max="100" step="0.01" value="${t.engagement_rate_pct ?? ""}" style="margin-top:3px;padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px;width:90px"/>
        </label>
        <button type="submit" class="btn" style="padding:5px 11px;font-size:11px">Speichern</button>
      </form>
      ${t.notes ? `<div style="margin-top:10px;color:var(--fg-3);font-size:12px;font-family:var(--font-body);font-style:italic">${esc(t.notes)}</div>` : ""}
    </td></tr>`;
  };
  const tableBody = rows.length === 0
    ? `<tr><td colspan="7" class="muted">Keine Targets in dieser Auswahl. ${(platform !== "all" || status !== "all" || app !== "all" || q) ? `<a class="applink" href="/admin?view=outreach">Filter zurücksetzen</a>` : "Füg einen mit dem Formular oben hinzu."}</td></tr>`
    : rows.map(targetRow).join("");

  // Wave-Starter: kicks off an Apify-driven discovery + Mail-1 send for
  // selected apps.
  const liveApps = KLAR_APPS.filter((a) => a.status === "LIVE");
  const waveAppCheckboxes = liveApps
    .map((a) => `<label class="wave-pick" style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font-size:13px;cursor:pointer">
      <input type="checkbox" name="apps" value="${esc(a.slug)}" class="wave-app-chk" style="margin:0"/>${esc(a.name)}
    </label>`).join("");

  const defaultMailSubject = "Quick collab idea — {{app_name}} x @{{handle}}";
  const defaultMailBody = `Hi {{name}},

[1 spezifischer Satz zu ihrem Content der zeigt dass du wirklich folgst].

Quick intro: I'm Alain, solo-dev behind {{app_name}}, [1-sentence USP].

Why I'm writing: your audience overlaps strongly with our users. What I can offer:
- Free Lifetime Premium for you, no strings
- Your personal affiliate link: 50% revenue-share on every Premium sub it brings in, for 24 months, auto-tracked, paid out monthly (Wise/PayPal/SEPA)
- Optional flat fee per post on top if you'd rather de-risk it
- Full creative freedom, no scripts, no approval cycles

If interested I'll send a 5-min Loom of the app plus 2-3 hook ideas in your content style. If not, no worries.

Cheers,
Alain
getklar.org`;

  const sizeBuckets: Array<{ value: string; label: string; range: string; defaultOn: boolean }> = [
    { value: "nano",  label: "Nano",  range: "1-10k",   defaultOn: false },
    { value: "micro", label: "Micro", range: "10-50k",  defaultOn: true  },
    { value: "mid",   label: "Mid",   range: "50-500k", defaultOn: true  },
    { value: "macro", label: "Macro", range: "500k+",   defaultOn: false },
  ];
  const sizeChips = sizeBuckets
    .map((b) => `<label class="wave-pick" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;padding:8px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font-size:12px;cursor:pointer;min-width:78px">
      <input type="checkbox" name="size_buckets" value="${esc(b.value)}"${b.defaultOn ? " checked" : ""} class="wave-size-chk" style="margin:0"/>
      <span style="font-weight:600">${esc(b.label)}</span>
      <span class="muted" style="font-size:10px;font-family:var(--font-mono)">${esc(b.range)}</span>
    </label>`).join("");

  const regionChips: Array<{ value: string; label: string; flag: string; market: string; defaultOn: boolean }> = [
    { value: "de", label: "DE", flag: "🇩🇪", market: "DACH",          defaultOn: true  },
    { value: "en", label: "EN", flag: "🌐", market: "Global EN",     defaultOn: false },
    { value: "es", label: "ES", flag: "🇪🇸", market: "España + LatAm", defaultOn: false },
    { value: "it", label: "IT", flag: "🇮🇹", market: "Italia",        defaultOn: false },
    { value: "fr", label: "FR", flag: "🇫🇷", market: "France + BE",   defaultOn: false },
  ];
  const regionChipsHtml = regionChips
    .map((r) => `<label class="wave-pick" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;padding:8px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font-size:12px;cursor:pointer;min-width:88px">
      <input type="radio" name="languages" value="${esc(r.value)}"${r.defaultOn ? " checked" : ""} class="wave-lang-chk" style="margin:0"/>
      <span style="font-weight:600">${esc(r.flag)} ${esc(r.label)}</span>
      <span class="muted" style="font-size:10px;font-family:var(--font-mono)">${esc(r.market)}</span>
    </label>`).join("");

  const waveForm = `<section style="background:var(--surface);border:1px solid var(--line-strong);border-radius:14px;padding:24px 28px;margin-bottom:32px;box-shadow:var(--shadow-sm)">
    <h2 style="margin:0 0 4px;font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:-0.02em;text-transform:none;color:var(--fg)">Welle starten</h2>
    <p class="muted" style="margin:0 0 22px;font-size:13px">Apify scraped die gewählten Plattformen, Apps und Größen-Buckets, schickt Mail-1 via Brevo, trackt alles in der DB. Templates pro App lädst du unten oder unter <a class="applink" href="/admin/templates">Templates</a>.</p>
    <form method="POST" action="/admin/outreach/start" id="wave-form" style="display:flex;flex-direction:column;gap:22px">
      <div>
        <div class="k" style="margin-bottom:10px">Apps <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">Multi-Select, nur LIVE</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${waveAppCheckboxes}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
        <div>
          <div class="k" style="margin-bottom:10px">Plattformen</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <label class="wave-pick" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" name="platforms" value="tiktok" checked class="wave-plat-chk" style="margin:0"/>TikTok
            </label>
            <label class="wave-pick" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" name="platforms" value="instagram" checked class="wave-plat-chk" style="margin:0"/>Instagram
            </label>
          </div>
        </div>
        <div>
          <div class="k" style="margin-bottom:10px">Größen</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${sizeChips}</div>
        </div>
        <div style="grid-column:1/-1">
          <div class="k" style="margin-bottom:10px">Region <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">Single-Select. Region wählt Hashtag-Bucket + Mail-Template aus DB. Multi-Region wäre cost-suboptimal (überlappende Scrapes).</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${regionChipsHtml}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 240px;gap:24px;align-items:end">
        <label style="display:flex;flex-direction:column">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span class="k">Anzahl pro App</span>
            <span id="wave-count-display" style="font-family:var(--font-display);font-weight:800;font-size:28px;line-height:1;letter-spacing:-0.02em;color:var(--fg);font-variant-numeric:tabular-nums">20</span>
          </div>
          <input type="range" name="count_per_app" min="5" max="100" step="5" value="20" id="wave-count" class="wave-slider" style="width:100%;accent-color:var(--fg);cursor:pointer"/>
          <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px;color:var(--fg-4);margin-top:4px">
            <span>5</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </label>
        <label style="display:flex;flex-direction:column">
          <span class="k" style="margin-bottom:6px">Niche-Keyword</span>
          <input type="text" name="niche" maxlength="80" placeholder="optional, z.B. yarn" style="padding:9px 12px;border:1px solid var(--line-strong);border-radius:8px;background:var(--bg);color:var(--fg);font-size:13px"/>
        </label>
      </div>

      <details id="wave-mail-details" style="border:1px solid var(--line);border-radius:8px;background:var(--surface-2)">
        <summary style="cursor:pointer;padding:12px 16px;font-size:13px;color:var(--fg-2);font-weight:600;user-select:none;display:flex;justify-content:space-between;align-items:center">
          <span><span style="opacity:0.5">▸</span> Mail bearbeiten <span class="muted" style="font-weight:400;font-size:11px;margin-left:8px">(default: pro App eigenes Template aus der DB)</span></span>
          <span id="wave-mail-summary" class="muted" style="font-size:11px;font-family:var(--font-mono)">geschlossen = App-Default</span>
        </summary>
        <div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:14px">
          <label style="display:flex;flex-direction:column">
            <span class="k" style="margin-bottom:6px">Mail-Subject</span>
            <input type="text" name="mail_subject" maxlength="200" value="${esc(defaultMailSubject)}" style="padding:8px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-mono)"/>
          </label>
          <label style="display:flex;flex-direction:column">
            <span class="k" style="margin-bottom:6px">Mail-Body <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">{{name}}, {{handle}}, {{app_name}} werden pro Target ersetzt</span></span>
            <textarea name="mail_body" rows="14" style="padding:10px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical;line-height:1.5">${esc(defaultMailBody)}</textarea>
          </label>
          <div id="wave-template-status" class="muted" style="font-family:var(--font-mono);font-size:11px;font-style:italic"></div>
        </div>
      </details>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding-top:14px;border-top:1px solid var(--line);flex-wrap:wrap">
        <div id="wave-cost" class="muted" style="font-family:var(--font-mono);font-size:12px">
          <span class="k" style="margin-right:8px">Schätzung</span>
          <span id="wave-cost-display">— Apps + Plattformen wählen</span>
        </div>
        <button type="submit" class="btn" style="padding:11px 22px;font-size:14px">Welle starten →</button>
      </div>
    </form>
  </section>`;
  // Run-History compact-Tabelle (letzte 10 Runs).
  const STALE_MS = 10 * 60 * 1000;  // running > 10min → "may be stuck"
  const now = Date.now();
  const isStale = (r: OutreachRun) =>
    r.status === "running" && r.started_at &&
    now - new Date(r.started_at).getTime() > STALE_MS;

  const getPhaseLabel = (r: OutreachRun): { label: string; tone: "wait" | "active" | "done" | "warn" } | null => {
    if (r.status === "queued") return { label: "queued", tone: "wait" };
    if (r.status === "done") {
      const wasBackstop = r.errors && typeof r.errors === "object" && (r.errors as Record<string, unknown>).phase === "backstop";
      if (wasBackstop) return { label: "0 targets (backstopped)", tone: "warn" };
      return null; // status pill suffices
    }
    if (r.status === "failed" || r.status === "cancelled") return null;
    if (r.status !== "running" || !r.started_at) return null;
    const ageSec = (now - new Date(r.started_at).getTime()) / 1000;
    const added = r.targets_added ?? 0;
    const sent = r.mails_sent ?? 0;
    if (added === 0 && sent === 0) {
      if (ageSec < 90) return { label: "Apify scraping", tone: "active" };
      if (ageSec < 60 + STALE_MS / 1000) return { label: "Backstop ETA <60s", tone: "wait" };
      return { label: "stale", tone: "warn" };
    }
    if (added > 0 && sent < added) return { label: `sending mails (${sent}/${added})`, tone: "active" };
    if (added > 0 && sent === added) return { label: "finalizing", tone: "active" };
    return null;
  };

  const phaseToneMap: Record<"wait" | "active" | "done" | "warn", RunBadgeTone> = {
    wait: "warn",
    active: "info",
    done: "ok",
    warn: "danger",
  };
  const runStatusTone = (r: OutreachRun): RunBadgeTone => {
    if (isStale(r)) return "danger";
    return r.status === "done" ? "ok"
      : r.status === "running" ? "info"
      : r.status === "failed" ? "danger"
      : r.status === "queued" ? "warn"
      : "neutral";
  };

  const hasRunningWave = runs.some((r) => r.status === "running" || r.status === "queued");

  // Per-run display data for the shadcn <OutreachRuns> component — plain strings
  // + badge tones, reusing the phase/stale logic above. No HTML, no mail logic.
  const runsData: RunRowData[] = runs.map((r) => {
    const hasDetail = Boolean(
      r.errors || r.status === "failed" || isStale(r) || r.niche || (r.mail_subject && r.mail_subject.length > 0),
    );
    const running = r.status === "running" && !!r.started_at;
    const duration = r.finished_at && r.started_at
      ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
      : running && r.started_at
        ? `${Math.round((now - new Date(r.started_at).getTime()) / 1000)}s`
        : "—";
    const phase = getPhaseLabel(r);
    return {
      id: r.id,
      whenRel: fmtRelative(r.created_at),
      apps: r.apps ?? [],
      language: r.language ?? "de",
      platforms: r.platforms ?? [],
      count: r.count_per_app,
      costEstimate: r.cost_estimate_usd != null ? Number(r.cost_estimate_usd) : null,
      costActual: r.cost_actual_usd != null ? Number(r.cost_actual_usd) : null,
      targetsAdded: r.targets_added,
      mailsSent: r.mails_sent,
      duration,
      running,
      statusLabel: isStale(r) ? "stale running" : r.status,
      statusTone: runStatusTone(r),
      phaseLabel: phase?.label ?? null,
      phaseTone: phase ? phaseToneMap[phase.tone] : null,
      detail: hasDetail
        ? {
            buckets: r.size_buckets && r.size_buckets.length > 0 ? r.size_buckets.join(", ") : "—",
            niche: r.niche ?? "—",
            duration,
            runIdShort: r.id.slice(0, 8),
            mailSubject: r.mail_subject || null,
            errorsJson: r.errors ? JSON.stringify(r.errors, null, 2) : null,
          }
        : null,
    };
  });

  // ===== Targets nach App + Status (Angefragt / Reply / Angenommen) =====
  type Bucket = "angefragt" | "reply" | "angenommen";
  const targetBucket = (t: OutreachTarget): Bucket | null => {
    if (t.status === "converted") return "angenommen";
    if (t.status === "replied") return "reply";
    if (t.mail_status === "mail1_sent" || t.mail_status === "mail2_sent" || t.status === "dm_sent") return "angefragt";
    return null; // queued / declined / dead → hier nicht zeigen
  };
  const byAppBucket = new Map<string, Record<Bucket, OutreachTarget[]>>();
  for (const meta of KLAR_APPS) {
    byAppBucket.set(meta.slug, { angefragt: [], reply: [], angenommen: [] });
  }
  for (const t of allTargets) {
    const b = targetBucket(t);
    if (!b) continue;
    for (const slug of (t.for_apps ?? [])) {
      const bucket = byAppBucket.get(slug);
      if (bucket) bucket[b].push(t);
    }
  }
  const newestFirst = (a: OutreachTarget, b: OutreachTarget) => {
    const ax = new Date(a.last_message_at || a.mail1_sent_at || a.updated_at).getTime();
    const bx = new Date(b.last_message_at || b.mail1_sent_at || b.updated_at).getTime();
    return bx - ax;
  };
  for (const bucket of byAppBucket.values()) {
    bucket.angefragt.sort(newestFirst);
    bucket.reply.sort(newestFirst);
    bucket.angenommen.sort(newestFirst);
  }

  const renderInfluencerMini = (t: OutreachTarget): string => {
    const sentRel = t.mail1_sent_at ? fmtRelative(t.mail1_sent_at) : "";
    const fLabel = t.follower_estimate
      ? (t.follower_estimate >= 1_000_000
          ? `${(t.follower_estimate / 1_000_000).toFixed(1)}M`
          : t.follower_estimate >= 1_000
            ? `${Math.round(t.follower_estimate / 1_000)}k`
            : String(t.follower_estimate))
      : "";
    const profileLink = t.profile_url
      ? `<a class="applink" href="${esc(t.profile_url)}" target="_blank" rel="noopener" style="font-weight:600">@${esc(t.handle)}</a>`
      : `<span style="font-weight:600">@${esc(t.handle)}</span>`;
    const platIcon = t.platform === "tiktok" ? "TT" : "IG";
    return `<div style="padding:8px 10px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px">
      <div style="min-width:0;flex:1">
        <div style="display:flex;gap:6px;align-items:center">
          ${profileLink}
          <span class="pill" style="font-size:8px;padding:1px 5px">${platIcon}</span>
          ${fLabel ? `<span class="muted" style="font-size:10px;font-family:var(--font-mono)">${esc(fLabel)}</span>` : ""}
        </div>
        ${t.contact_email ? `<div class="muted" style="font-size:10px;margin-top:1px;font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.contact_email)}</div>` : ""}
        ${t.last_message ? `<div class="muted" style="font-size:10px;margin-top:2px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.last_message)}">↩ ${esc(t.last_message.slice(0, 90))}</div>` : ""}
      </div>
      <div class="muted" style="font-size:10px;white-space:nowrap;text-align:right">${esc(sentRel)}</div>
    </div>`;
  };

  const renderBucketCol = (label: string, items: OutreachTarget[], emoji: string): string => `
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;min-height:120px">
      <div style="padding:10px 12px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:baseline">
        <span class="k">${emoji} ${esc(label)}</span>
        <span style="font-family:var(--font-display);font-weight:800;font-size:18px;color:var(--fg)">${items.length}</span>
      </div>
      ${items.length === 0
        ? `<div class="muted" style="padding:12px;font-style:italic;font-size:11px">keine Einträge</div>`
        : items.slice(0, 8).map(renderInfluencerMini).join("") +
          (items.length > 8 ? `<div class="muted" style="padding:8px 12px;font-size:11px">+ ${items.length - 8} weitere</div>` : "")}
    </div>`;

  const targetsByAppSection = `<h2 style="margin-top:32px">Targets nach App</h2>
    <p class="sub muted" style="margin:0 0 18px;font-size:12px">Influencer aus der Pipeline pro App gruppiert, nach Status: Angefragt → Reply → Angenommen. Targets mit mehreren App-Tags erscheinen in jedem Block. Top 8 pro Spalte angezeigt.</p>
    <div style="display:flex;flex-direction:column;gap:14px">
      ${KLAR_APPS.map((meta) => {
        const bucket = byAppBucket.get(meta.slug)!;
        const total = bucket.angefragt.length + bucket.reply.length + bucket.angenommen.length;
        const isOpen = total > 0;
        return `<details ${isOpen ? "open" : ""} style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:14px 18px">
          <summary style="cursor:pointer;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;user-select:none">
            <span>${esc(meta.name)} <span class="muted" style="font-weight:400;font-size:11px;margin-left:6px">${esc(meta.slug)}</span></span>
            <span class="muted" style="font-family:var(--font-mono);font-size:11px">${bucket.angefragt.length} angefragt · ${bucket.reply.length} reply · ${bucket.angenommen.length} angenommen</span>
          </summary>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px">
            ${renderBucketCol("Angefragt", bucket.angefragt, "✉")}
            ${renderBucketCol("Reply", bucket.reply, "↩")}
            ${renderBucketCol("Angenommen", bucket.angenommen, "✓")}
          </div>
        </details>`;
      }).join("")}
    </div>`;

  // Apify-Account-Card: live aus Apify API (GET /v2/users/me/limits).
  const apifyAccCap = apifyAccount.max_monthly_usage_usd;
  const apifyAccPct = apifyAccCap && apifyAccCap > 0
    ? Math.min(100, Math.round((apifyAccount.monthly_usage_usd / apifyAccCap) * 100))
    : 0;
  const apifyAccColor = apifyAccPct >= 90 ? "var(--danger)" : apifyAccPct >= 70 ? "var(--warning)" : "var(--success)";
  const fmtCycle = (iso: string | null): string => {
    if (!iso) return "?";
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2,"0")}.${String(d.getUTCMonth()+1).padStart(2,"0")}.`;
  };
  const klarWelleShare = apifyAccount.monthly_usage_usd > 0
    ? Math.round(((costSummary.month_apify_actual_usd || costSummary.month_apify_estimate_usd) / apifyAccount.monthly_usage_usd) * 100)
    : null;
  const apifyAccCard = `<section style="background:var(--surface);border:1px solid var(--line-strong);border-radius:12px;padding:18px 22px;margin-bottom:14px;box-shadow:var(--shadow-sm)">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
      <h2 style="margin:0;font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:-0.01em;text-transform:none;color:var(--fg)">Apify-Account ${apifyAccount.ok ? "" : `<span class="muted" style="font-size:10px;font-weight:400;margin-left:8px">(${apifyAccount.reason})</span>`}</h2>
      <span class="muted" style="font-size:11px;font-family:var(--font-mono)">${apifyAccount.ok ? `Cycle ${fmtCycle(apifyAccount.cycle_start)} – ${fmtCycle(apifyAccount.cycle_end)}` : "live aus GET /v2/users/me/limits"}</span>
    </div>
    ${apifyAccount.ok ? `<div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:6px">
        <span class="k">Spend diesen Cycle <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">alle Aktoren, nicht nur Klar</span></span>
        <span style="font-family:var(--font-mono);color:var(--fg);font-size:14px"><strong>$${apifyAccount.monthly_usage_usd.toFixed(2)}</strong>${apifyAccCap ? ` / $${apifyAccCap.toFixed(0)} Plan-Cap` : " <span class=\"muted\" style=\"font-size:10px;font-weight:400\">(kein Cap gesetzt)</span>"}</span>
      </div>
      ${apifyAccCap ? `<div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${apifyAccPct}%;background:${apifyAccColor};transition:width .3s"></div>
      </div>
      <div class="muted" style="font-size:10px;margin-top:4px;display:flex;justify-content:space-between">
        <span>${apifyAccPct}% des Plan-Caps</span>
        ${klarWelleShare !== null ? `<span>Klar-Wellen-Anteil ~${klarWelleShare}% ($${(costSummary.month_apify_actual_usd || costSummary.month_apify_estimate_usd).toFixed(2)})</span>` : ""}
      </div>` : `<div class="muted" style="font-size:10px;margin-top:4px">Pay-as-you-go ohne Cap. Du kannst in der Apify-Console unter Settings &rarr; Limits einen monthly cap setzen.</div>`}
      ${apifyAccount.compute_units_used !== null && apifyAccount.compute_units_max ? `<div class="muted" style="font-size:10px;margin-top:8px;font-family:var(--font-mono)">Compute-Units: ${apifyAccount.compute_units_used.toLocaleString()} / ${apifyAccount.compute_units_max.toLocaleString()} CU</div>` : ""}
      ${apifyAccCap && apifyAccPct >= 70 ? `<p style="font-size:11px;margin:10px 0 0;color:${apifyAccColor};font-style:italic">${apifyAccPct >= 90 ? "Plan-Cap fast erreicht: " : "Plan-Cap wird knapp: "}weitere Wellen oder andere Apify-Aktoren können den Cap sprengen. <a href="https://console.apify.com/billing/limits" target="_blank" style="color:inherit">Cap in Apify-Console anpassen</a>.</p>` : ""}
    </div>` : `<div class="muted" style="font-size:12px">
      Apify-Account-Status nicht abrufbar.
      ${apifyAccount.reason === "no-token" ? "<code>APIFY_API_TOKEN</code> in Vercel env-vars fehlt." : ""}
      ${apifyAccount.reason === "http-error" ? "Apify-API gab Fehler zurück (Token gültig?)." : ""}
      ${apifyAccount.reason === "exception" ? "Netzwerk-Fehler beim Lookup." : ""}
    </div>`}
  </section>`;

  // Brevo-Quota-Card: live aus Brevo /v3/smtp/statistics/aggregatedReport (today).
  const brevoQuotaCard = (() => {
    if (brevoQuota.state === "no-key") {
      return `<section style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 22px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h2 style="margin:0;font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:-0.01em;text-transform:none;color:var(--fg)">Brevo Daily-Cap <span class="muted" style="font-size:10px;font-weight:400;margin-left:8px">(no-key)</span></h2>
          <span class="muted" style="font-size:11px;font-family:var(--font-mono)">live aus /v3/smtp/statistics/aggregatedReport</span>
        </div>
        <p class="muted" style="font-size:12px;margin:8px 0 0">Setze <code>BREVO_API_KEY</code> in Vercel env-vars (Master API-Key aus Brevo SMTP &amp; API). Free-Plan = 300 Mails/Tag, Reset 00:00 UTC.</p>
      </section>`;
    }
    if (brevoQuota.state === "http-error" || brevoQuota.state === "exception") {
      const note = brevoQuota.state === "http-error" ? `HTTP ${brevoQuota.status}: ${brevoQuota.bodySnippet}` : brevoQuota.message;
      return `<section style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 22px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h2 style="margin:0;font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:-0.01em;text-transform:none;color:var(--fg)">Brevo Daily-Cap <span class="muted" style="font-size:10px;font-weight:400;margin-left:8px">(error)</span></h2>
        </div>
        <p class="muted" style="font-size:11px;margin:8px 0 0;font-family:var(--font-mono)">${esc(note)}</p>
      </section>`;
    }
    const used = brevoQuota.usedToday;
    const cap = brevoQuota.capDaily;
    const pct = Math.min(100, Math.round((used / cap) * 100));
    const color = pct >= 90 ? "var(--danger)" : pct >= 70 ? "var(--warning)" : "var(--success)";
    const resetUtc = new Date();
    resetUtc.setUTCHours(24, 0, 0, 0);
    const hoursUntilReset = Math.max(0, Math.round((resetUtc.getTime() - Date.now()) / 3600000 * 10) / 10);
    return `<section style="background:var(--surface);border:1px solid var(--line-strong);border-radius:12px;padding:18px 22px;margin-bottom:14px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
        <h2 style="margin:0;font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:-0.01em;text-transform:none;color:var(--fg)">Brevo Daily-Cap${brevoQuota.planName ? ` <span class="muted" style="font-size:10px;font-weight:400;margin-left:8px">${esc(brevoQuota.planName)}</span>` : ""}</h2>
        <span class="muted" style="font-size:11px;font-family:var(--font-mono)">Reset in ~${hoursUntilReset}h (00:00 UTC)</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:6px">
        <span class="k">Mails heute <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">account-wide, inkl. nicht-Klar-Sends</span></span>
        <span style="font-family:var(--font-mono);color:var(--fg);font-size:14px"><strong>${used}</strong> / ${cap}</span>
      </div>
      <div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};transition:width .3s"></div>
      </div>
      <div class="muted" style="font-size:10px;margin-top:4px;display:flex;justify-content:space-between">
        <span>${pct}% des Daily-Caps</span>
        <span>Rest heute: ${Math.max(0, cap - used)} Mails</span>
      </div>
      ${pct >= 70 ? `<p style="font-size:11px;margin:10px 0 0;color:${color};font-style:italic">${pct >= 90 ? "Daily-Cap fast erreicht: " : "Daily-Cap wird knapp: "}neue Wellen werden ggf. von Brevo geblockt bis 00:00 UTC. <a href="https://app.brevo.com/billing/plan" target="_blank" style="color:inherit">Plan upgraden</a> für höheren Cap.</p>` : ""}
    </section>`;
  })();

  // Klar-Wellen-Cost-Tracker.
  const apifyUsed = costSummary.month_apify_actual_usd || costSummary.month_apify_estimate_usd;
  const actualPct = costSummary.month_apify_estimate_usd > 0
    ? Math.round((costSummary.month_apify_actual_usd / costSummary.month_apify_estimate_usd) * 100)
    : null;
  const brevoPct = Math.min(100, Math.round((costSummary.brevo_today_count / costSummary.brevo_free_daily_cap) * 100));
  const brevoColor = brevoPct >= 90 ? "var(--danger)" : brevoPct >= 70 ? "var(--warning)" : "var(--success)";
  const costCard = `<section style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 22px;margin-bottom:24px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px">
      <h2 style="margin:0;font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:-0.01em;text-transform:none;color:var(--fg)">Klar-Wellen diesen Monat</h2>
      <span class="muted" style="font-size:11px;font-family:var(--font-mono)">${costSummary.month_runs_count} Wellen · ${costSummary.month_targets_added} Targets · ${costSummary.month_mails_sent} Mails</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:6px">
          <span class="k">Apify-Cost <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0;font-size:10px">nur Klar-Wellen</span></span>
          <span style="font-family:var(--font-mono);color:var(--fg)"><strong>$${apifyUsed.toFixed(2)}</strong> <span class="muted" style="font-size:10px;font-weight:400">${costSummary.month_apify_actual_usd > 0 ? "actual via usageTotalUsd" : "estimate"}</span></span>
        </div>
        <div class="muted" style="font-size:10px;margin-top:4px">
          Estimate $${costSummary.month_apify_estimate_usd.toFixed(2)} · Actual $${costSummary.month_apify_actual_usd.toFixed(2)}${actualPct !== null ? ` (${actualPct}% des Estimates)` : ""}
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:6px">
          <span class="k">Brevo (heute)</span>
          <span style="font-family:var(--font-mono);color:var(--fg)"><strong>${costSummary.brevo_today_count}</strong> / ${costSummary.brevo_free_daily_cap} Free-Tier/Tag</span>
        </div>
        <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${brevoPct}%;background:${brevoColor};transition:width .3s"></div>
        </div>
        <div class="muted" style="font-size:10px;margin-top:4px">${costSummary.month_mails_sent} Mails gesamt diesen Monat · ${brevoPct}% Tages-Cap</div>
      </div>
    </div>
    ${brevoPct >= 70 ? `<p class="muted" style="font-size:11px;margin:12px 0 0;font-style:italic">Brevo-Tages-Cap wird knapp, morgen wieder fresh.</p>` : ""}
  </section>`;

  // Suppression-Section.
  const suppressionReasons: Array<{ value: string; label: string }> = [
    { value: "manual",         label: "Manuell (Admin-Entscheidung)" },
    { value: "stop_request",   label: "STOP-Antwort vom Influencer" },
    { value: "bounce",         label: "Mail-Bounce (Brevo)" },
    { value: "spam_complaint", label: "Spam-Complaint" },
    { value: "opted_out",      label: "Explizit opted-out" },
    { value: "invalid",        label: "Ungültiger Handle/Email" },
    { value: "double_ask",     label: "Schon vorher angefragt" },
  ];
  const suppressionRowsHtml = suppressions.length === 0
    ? `<tr><td colspan="5" class="muted" style="padding:14px 16px;text-align:center;font-size:12px">Noch keine Suppressions. Cold-DM-Pipeline läuft offen.</td></tr>`
    : suppressions.map((s: SuppressionRow) => `<tr>
        <td><span class="muted" style="font-size:11px;white-space:nowrap">${fmtRelative(s.created_at)}</span></td>
        <td style="font-family:var(--font-mono);font-size:12px">@${esc(s.handle)}</td>
        <td><span class="pill" style="font-size:9px;padding:1px 6px;text-transform:uppercase">${esc(s.platform)}</span></td>
        <td><span class="pill" style="font-size:9px;padding:1px 6px">${esc(s.reason)}</span><div class="muted" style="font-size:10px;margin-top:2px">${esc(s.source)}</div></td>
        <td class="muted" style="font-size:11px">${esc(s.email ?? "—")}${s.notes ? `<div style="font-size:10px;margin-top:2px;font-style:italic">${esc(s.notes)}</div>` : ""}</td>
      </tr>`).join("");
  const suppressionSection = `<details style="margin-top:32px;border:1px solid var(--line);border-radius:10px;background:var(--surface)">
    <summary style="cursor:pointer;padding:14px 18px;font-size:14px;color:var(--fg);font-weight:700;user-select:none;display:flex;justify-content:space-between;align-items:center">
      <span>Suppression-List <span class="muted" style="font-weight:400;font-size:11px;margin-left:8px">do-not-contact, ${suppressions.length} Einträge</span></span>
      <span class="muted" style="font-size:11px;font-family:var(--font-mono)">n8n: <code>POST /api/outreach/check-suppression</code></span>
    </summary>
    <div style="padding:0 18px 18px">
      <form method="POST" action="/admin/outreach/suppression-add" style="display:grid;grid-template-columns:1.5fr 0.8fr 1.2fr 1.5fr auto;gap:10px;margin-bottom:18px;align-items:end">
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Handle (ohne @)
          <input type="text" name="handle" required maxlength="80" placeholder="sammyknits" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-mono)"/>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Plattform
          <select name="platform" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px">
            <option value="*">Beide</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Grund
          <select name="reason" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px">
            ${suppressionReasons.map((r) => `<option value="${esc(r.value)}">${esc(r.label)}</option>`).join("")}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase">Notiz <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span>
          <input type="text" name="notes" maxlength="500" placeholder="z.B. Replied 'no thanks'" style="margin-top:4px;padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
        </label>
        <button type="submit" class="btn" style="padding:8px 14px;font-size:13px">+ Sperren</button>
      </form>
      <table>
        <thead><tr><th>Wann</th><th>Handle</th><th>Plattform</th><th>Grund / Quelle</th><th>Email / Notiz</th></tr></thead>
        <tbody>${suppressionRowsHtml}</tbody>
      </table>
    </div>
  </details>`;
  // Reply-Inbox lebt jetzt zentral im Postfach (/admin/replies); Outreach ist
  // reiner Scraper/Wave-Tool. "Eingegangene Antworten" + "Offene Anfragen" sind
  // dorthin gewandert.
  // Split into fragments so the KPI cards + filter strip can render as shadcn
  // React components between them. The wave form, run history, targets-by-app,
  // add form, target table and suppression list stay as HTML strings (their
  // inline scripts query the document, so splitting the markup is harmless).
  const topHtml = `<h1>Outreach</h1>
    <p class="sub">Influencer-Outreach-Tracker. <em>Queued → DM gesendet → Antwort → Converted</em>. Auto-Refresh ${autoRefresh ? "alle 15s" : "aus"}, Daten aus Supabase anime-vault.</p>
    ${apifyAccCard}
    ${brevoQuotaCard}`;

  const midTopHtml = `${costCard}
    ${waveForm}
    <div style="margin:32px 0 16px;border-top:1px solid var(--line)"></div>`;

  const midBotHtml = `<div style="margin:32px 0 16px;border-top:1px solid var(--line)"></div>
    ${targetsByAppSection}
    <div style="margin:32px 0 16px;border-top:1px solid var(--line)"></div>
    ${addForm}`;

  const bottomHtml = `<h2>Targets <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${rows.length} angezeigt${q ? ` · Suche: <em>${esc(q)}</em>` : ""}</span></h2>
    ${testsToggle}
    <table>
      <thead><tr><th>Lead</th><th>Plattform</th><th class="r">Follower</th><th class="r">Views</th><th>Apps</th><th>Status</th><th class="r">Aktionen</th></tr></thead>
      <tbody>${tableBody}</tbody>
    </table>
    ${suppressionSection}`;

  return {
    configured: true,
    topHtml,
    midTopHtml,
    runs: runsData,
    hasRunningWave,
    midBotHtml,
    bottomHtml,
    stats,
    filter: { platform, status, app, q, autoRefresh, showTests, statusOptions, appOptions },
  };
}

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; s?: string; a?: string; q?: string; ar?: string; show_tests?: string; msg?: string }>;
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
  const filterPlatform = sp.p ?? "all";
  const filterStatus = sp.s ?? "all";
  const filterApp = sp.a ?? "all";
  const query = sp.q ?? "";
  const autoRefresh = sp.ar === "1";
  const showTests = sp.show_tests === "1";

  const apps = getApps();
  const result = await outreachMain(filterPlatform, filterStatus, filterApp, query, autoRefresh, showTests);
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const sidebar = adminSidebar("outreach", apps);
  const topbar = `
    <span class="crumb"><b>Outreach</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Outreach · Klar Control</title>
      {autoRefresh ? <meta httpEquiv="refresh" content="15" /> : null}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div dangerouslySetInnerHTML={{ __html: MODAL_HTML }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            {result.configured ? (
              <>
                <div dangerouslySetInnerHTML={{ __html: flash + result.topHtml }} />
                <OutreachKpis stats={result.stats} />
                <div dangerouslySetInnerHTML={{ __html: result.midTopHtml }} />
                <OutreachRuns runs={result.runs} hasRunningWave={result.hasRunningWave} />
                <div dangerouslySetInnerHTML={{ __html: result.midBotHtml }} />
                <OutreachFilters {...result.filter} />
                <div dangerouslySetInnerHTML={{ __html: result.bottomHtml }} />
              </>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: flash + result.html }} />
            )}
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: MODAL_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: ADD_FORM_JS }} />
      <script dangerouslySetInnerHTML={{ __html: WAVE_FORM_JS }} />
    </>
  );
}
