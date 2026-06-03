// Central Klar payout control-plane. Server-rendered, no client JS, all
// secrets server-side. Gated by KLAR_ADMIN_KEY (query ?key= once -> cookie).
// Views via ?view= : overview | revenue | <app-slug> | outreach
//
// Styling mirrors the klar brand (oklch tokens, editorial brutalism).
// Fonts: Space Grotesk (display) + Inter (UI) + Instrument Serif (italic
// intros), via Google Fonts. Restrained magenta accent for orientation.
// Revenue chart is server-rendered SVG (no client JS).
//
// Env: KLAR_ADMIN_KEY, KLAR_ADMIN_APPS (JSON registry, see lib/adminApps).

import { getApps, sbGet, setupLandingUrl, type AdminApp } from "../../lib/adminApps";
import { KLAR_APPS } from "../../lib/klarApps";
import {
  getOutreachStats,
  getOutreachPerAppStats,
  listOutreachTargets,
  listOutreachRuns,
  listSuppressions,
  getOutreachCostSummary,
  isOutreachConfigured,
  type OutreachPlatform,
  type OutreachStatus,
  type OutreachTarget,
  type OutreachRun,
  type PerAppStat,
  type SuppressionRow,
} from "../../lib/outreachStore";
import { getApifyAccountStatus } from "../../lib/apifyAccount";
import { getBrevoQuota } from "../../lib/brevoQuota";
import { REPLY_TEMPLATES, replyLang, type ReplyLang } from "../../lib/replyTemplates";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  MODAL_HTML,
  MODAL_SCRIPT,
  checkAuth,
  esc,
  adminSidebar,
  REPORTING_CURRENCY,
  eur,
  barChart,
  fmtRelative,
} from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// appView + its helpers (APP_TO_BRAND, SHAPE_B_APPS, deriveCode,
// trackingLinkFor, createAffiliateForm) migrated to the dynamic React route
// /admin/[app]/page.tsx. ?view=<slug> now 303-redirects there (query forwarded).

// Auth lives in _shared.ts (checkAuth) — requires KLAR_ADMIN_KEY +
// KLAR_TOTP_SECRET + KLAR_DEVICE_SECRET. /admin/login handles the form.
//
// Outreach-Tracker: 2026-05-22 von Google-Sheets auf Supabase
// (klar_outreach_targets in anime-vault, exiuwektrqxvycclqfdd) migriert.
// Liest + schreibt via src/lib/outreachStore.ts. Brauchte vorher
// KLAR_SHEETS_SA_JSON + KLAR_OUTREACH_SHEET_ID, jetzt entfernt.

// Contact-form inbox. Reads klar_inquiries from the anime-vault project with a
// service-role key (RLS-bypass for read). Service key lives only in Vercel env,
// never in the repo. Without it the view degrades to a setup hint.
const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

interface Inquiry {
  id?: string;
  created_at?: string;
  type?: string;
  email?: string;
  status?: string;
  handle?: string;
  audience?: string;
  platforms?: string;
  why?: string;
  name?: string;
  project?: string;
  budget?: string;
  brief?: string;
  source?: string;
  // Approval columns added 2026-05-20 via klar_inquiries_approval_columns:
  approved_app?: string;
  approved_code?: string;
  approved_at?: string;
  // S30d: Influencer-Wunsch-App aus dem Public-Form-Dropdown (pre-selection
  // bei /admin/inbox approve-form, plus visible chip in der Inbox-Tabelle).
  target_app?: string;
  // Decline-Audit (klar_inquiries_status_check erweitert um 'declined').
  declined_at?: string | null;
  decline_reason?: string | null;
}

// Known source values + readable labels + Pill-color tokens. Falls back to
// the raw value when an unknown source shows up (e.g. ad-hoc dm import).
const SOURCE_META: Record<string, { label: string; bg: string; fg: string }> = {
  "getklar.org":    { label: "Kontaktformular", bg: "#e0e7ff", fg: "#3730a3" },
  "outreach-reply": { label: "Outreach-Reply",  bg: "#fef3c7", fg: "#92400e" },
  "dm":             { label: "DM",              bg: "#fce7f3", fg: "#9d174d" },
  "manual":         { label: "Manuell",         bg: "#dcfce7", fg: "#166534" },
};
const SOURCE_KEYS = ["getklar.org", "outreach-reply", "dm", "manual"] as const;
function sourceLabel(s: string | undefined): string {
  if (!s) return "—";
  return SOURCE_META[s]?.label ?? s;
}
// Quiet-Pill-System (impeccable /quieter): EIN neutraler Flächenton für alle
// Pills, Farbe nur als zurückhaltende Text-Tönung über Tokens (dark-mode-fähig,
// statt harter Pastell-Fills). 60-30-10: Neutral dominiert, Akzent ist selten.
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

function sourcePill(s: string | undefined): string {
  if (!s) return quietPill("unbekannt", "neutral", "font-size:10px");
  const m = SOURCE_META[s];
  return quietPill(m ? m.label : s, "neutral", "font-size:10px");
}

// REPORTING_CURRENCY / money / eur moved to ./_shared.ts so the React admin
// routes (revenue, payouts) can reuse them. STYLE lives there too.

function doc(inner: string): Response {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Klar Control</title>
<script>${THEME_INIT_SCRIPT}</script>
<link rel="icon" type="image/png" href="/logo/klar-192.png"><link rel="apple-touch-icon" href="/logo/klar-maskable-512.png">
<link rel="manifest" href="/admin.webmanifest">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAF7"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0A0A0A">
<meta name="application-name" content="Klar Control"><meta name="apple-mobile-web-app-title" content="Klar Control">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_LINK}" rel="stylesheet">
<script type="speculationrules">{"prerender":[{"where":{"and":[{"href_matches":"/admin*"},{"not":{"href_matches":"/admin/logout*"}}]},"eagerness":"moderate"}]}</script>
<style>${STYLE}</style></head><body>
<canvas id="klar-smoke-bg" aria-hidden="true"></canvas>
<div class="klar-aurora" aria-hidden="true"></div>
${GLASS_SVG_DEFS}
${MODAL_HTML}
${inner}
<script>
${THEME_TOGGLE_SCRIPT}
${SMOKE_BG_SCRIPT}
${MODAL_SCRIPT}
if("serviceWorker"in navigator){addEventListener("load",function(){navigator.serviceWorker.register("/admin-sw.js",{scope:"/admin"}).catch(function(){})})}
</script></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// ICON record is now exported from ./_shared.

function shell(view: string, apps: AdminApp[], flash: string | null, main: string): string {
  const labels: Record<string, string> = {
    overview: "Übersicht", inbox: "Inbox", bookings: "Bookings", cal: "Cal Admin", revenue: "Einnahmen", payouts: "Auszahlungen", analytics: "Analytics", outreach: "Outreach",
  };
  const here =
    labels[view] ?? apps.find((a) => a.slug === view)?.name ?? "Übersicht";
  return `<div class="layout">
    <aside class="side">${adminSidebar(view, apps)}</aside>
    <main class="main">
      <div class="topbar">
        <span class="crumb"><b>${esc(here)}</b>${ICON.chevron}<span>Klar Control</span></span>
        <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
      </div>
      <div class="content">
        ${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
        ${main}
      </div>
    </main></div>`;
}

// barChart moved to ./_shared.ts (shared by overview + revenue + payouts).

// overview + appTabStrip migrated to their own React route at
// /admin/overview/page.tsx. Bare /admin and ?view=overview now 303-redirect there.

// revenueView migrated to its own React route at /admin/revenue/page.tsx.

// appView migrated to the dynamic React route /admin/[app]/page.tsx.

// ---- Outreach-Tracker -----------------------------------------------------
// Status-Lifecycle: queued -> dm_sent -> replied -> {converted, declined, dead}.
// Daten in klar_outreach_targets (anime-vault). Lese/Schreib via outreachStore.

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
// fmtRelative moved to ./_shared.ts (shared by route.ts views + overview route).

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

// ── Geteilte Reply-Assets (Outreach-View + Inbox-View) ───────────────────
// Template-Lookup für den Client (lang -> id -> {subject, body}), `<` escaped
// damit der JSON-Blob den <script>-Kontext nicht sprengt. Einmal beim
// Modul-Load gebaut (REPLY_TEMPLATES ist konstant).
const REPLY_TEMPLATE_JSON: string = (() => {
  const map: Record<string, Record<string, { subject: string; body: string }>> = {};
  for (const lng of Object.keys(REPLY_TEMPLATES) as ReplyLang[]) {
    map[lng] = {};
    for (const tpl of REPLY_TEMPLATES[lng]) map[lng][tpl.id] = { subject: tpl.subject, body: tpl.body };
  }
  return JSON.stringify(map).replace(/</g, "\\u003c");
})();

// Vorlagen-Dropdown: optgroup pro Sprache, value = "lang:id". Default
// selektiert = Interesse-Vorlage in der Sprache des Targets.
function replyTemplateSelectOptions(defLang: ReplyLang): string {
  return (Object.keys(REPLY_TEMPLATES) as ReplyLang[])
    .map(
      (lng) =>
        `<optgroup label="${lng.toUpperCase()}">` +
        REPLY_TEMPLATES[lng]
          .map(
            (tpl) =>
              `<option value="${esc(lng + ":" + tpl.id)}"${lng === defLang && tpl.id === "interesse" ? " selected" : ""}>${esc(tpl.label)}</option>`,
          )
          .join("") +
        `</optgroup>`,
    )
    .join("");
}

// Client-JS für die Reply-Karten: Vorlage einsetzen, Übersetzen (ruft
// /admin/outreach/translate), Entwurf kopieren. Selektoren scopen auf
// .reply-card, funktioniert daher in Outreach- wie Inbox-Karten.
const REPLY_INBOX_JS = `
window.KLAR_REPLY_TEMPLATES = ${REPLY_TEMPLATE_JSON};
function klarReplyFill(sel){
  var card = sel.closest('.reply-card'); if(!card) return;
  var parts = (sel.value||'').split(':'); var set = window.KLAR_REPLY_TEMPLATES[parts[0]];
  var tpl = set ? set[parts[1]] : null; if(!tpl) return;
  var name = card.getAttribute('data-name')||''; var handle = card.getAttribute('data-handle')||'';
  function sub(s){return (s||'').replace(/\\{\\{name\\}\\}/g,name).replace(/\\{\\{handle\\}\\}/g,handle);}
  var s = card.querySelector('.reply-subj'); var b = card.querySelector('.reply-text');
  if(s && tpl.subject) s.value = sub(tpl.subject);
  if(b) b.value = sub(tpl.body);
}
function klarTranslate(btn){
  var card = btn.closest('.reply-card'); if(!card) return;
  var src = card.querySelector('.reply-incoming'); var out = card.querySelector('.reply-trans');
  if(!src||!out) return;
  var text = src.getAttribute('data-raw') || src.textContent || '';
  var srcLang = src.getAttribute('data-src-lang') || '';
  out.textContent = 'Übersetze…';
  fetch('/admin/outreach/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text,target:'DE',source:srcLang})})
    .then(function(r){return r.json();})
    .then(function(d){ out.textContent = (d&&d.ok) ? ('['+(d.source||'?')+' \\u2192 DE'+(d.provider?' · '+d.provider:'')+'] '+d.text) : ('Übersetzung fehlgeschlagen: '+((d&&d.error)||'?')); })
    .catch(function(e){ out.textContent = 'Fehler: '+e; });
}
function klarCopyDraft(btn){
  var card = btn.closest('.reply-card'); if(!card) return;
  var b = card.querySelector('.reply-text'); if(!b) return;
  navigator.clipboard.writeText(b.value).then(function(){ var o=btn.textContent; btn.textContent='\\u2713 kopiert'; setTimeout(function(){btn.textContent=o;},1500); }).catch(function(){ btn.textContent='Copy fehlgeschlagen'; });
}
`;

async function outreachView(
  filterPlatform: string,
  filterStatus: string,
  filterApp: string,
  query: string,
  autoRefresh: boolean,
  showTests: boolean,
): Promise<string> {
  if (!isOutreachConfigured()) {
    return `<h1>Outreach</h1><p class="sub muted">Outreach-Tracker braucht <span class="warn">KLAR_INBOX_SERVICE_KEY</span> in Vercel (anime-vault Service-Role). Tabelle <code>klar_outreach_targets</code> ist via Migration <code>klar_outreach_targets_v1</code> + <code>v2_metrics</code> angelegt.</p>`;
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

  // Auto-refresh meta-tag (15s). Off by default — toggle via ?ar=1.
  // Wird inline am Anfang der Outreach-View ausgespuckt — Next legt das in
  // den Head dank React 19 Document-Metadata-Hoisting.
  const refreshMeta = autoRefresh
    ? `<meta http-equiv="refresh" content="15"/>`
    : "";

  // KPI-Cards (jetzt mit Mail-Counter)
  const cards = `<div class="cards">
    <div class="card"><div class="k">Total</div><div class="v">${stats.total}</div><div class="s">Targets im Tracker</div></div>
    <div class="card"><div class="k">Queued</div><div class="v">${stats.queued}</div><div class="s">noch nicht kontaktiert</div></div>
    <div class="card"><div class="k">Mails (7d)</div><div class="v">${stats.mails_last_7d}</div><div class="s">${stats.mails_total} gesamt rausgeschickt</div></div>
    <div class="card"><div class="k">Antworten</div><div class="v">${stats.replied + stats.converted + stats.declined}</div><div class="s">${stats.response_rate_pct ?? "—"}% Response-Rate</div></div>
    <div class="card"><div class="k">Converted (30d)</div><div class="v">${stats.converted_last_30d}</div><div class="s">${stats.conversion_rate_pct ?? "—"}% Conversion-Rate</div></div>
  </div>`;

  // Filter-Strip: hält query+autoRefresh+showTests mit
  const buildFilterHref = (p: string, s: string, a: string): string => {
    const parts: string[] = ["view=outreach"];
    if (p !== "all") parts.push(`p=${encodeURIComponent(p)}`);
    if (s !== "all") parts.push(`s=${encodeURIComponent(s)}`);
    if (a !== "all") parts.push(`a=${encodeURIComponent(a)}`);
    if (q) parts.push(`q=${encodeURIComponent(q)}`);
    if (autoRefresh) parts.push(`ar=1`);
    if (showTests) parts.push("show_tests=1");
    return `/admin?${parts.join("&")}`;
  };
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
  const segPlatform = `<div class="seg">
    <a href="${buildFilterHref("all", status, app)}" class="${platform === "all" ? "on" : ""}">Alle</a>
    <a href="${buildFilterHref("tiktok", status, app)}" class="${platform === "tiktok" ? "on" : ""}">TikTok</a>
    <a href="${buildFilterHref("instagram", status, app)}" class="${platform === "instagram" ? "on" : ""}">Instagram</a>
  </div>`;
  const segStatus = `<div class="seg">
    <a href="${buildFilterHref(platform, "all", app)}" class="${status === "all" ? "on" : ""}">Alle</a>
    ${TARGET_STATUS_ORDER.map((s) => `<a href="${buildFilterHref(platform, s, app)}" class="${status === s ? "on" : ""}">${esc(STATUS_LABEL[s])}</a>`).join("")}
  </div>`;
  const appOptions = ["all", ...KLAR_APPS.map((a) => a.slug)];
  const segApp = `<div class="seg" style="flex-wrap:wrap">
    ${appOptions.map((a) => `<a href="${buildFilterHref(platform, status, a)}" class="${app === a ? "on" : ""}">${esc(a === "all" ? "Alle Apps" : a)}</a>`).join("")}
  </div>`;

  // Such-Form (GET, sendet alle vorhandenen Filter mit, Reload via meta-refresh
  // bleibt sticky weil URL state der single-source-of-truth ist)
  const searchForm = `<form method="GET" action="/admin" style="display:flex;gap:8px;align-items:center;flex:1;max-width:480px">
    <input type="hidden" name="view" value="outreach"/>
    ${platform !== "all" ? `<input type="hidden" name="p" value="${esc(platform)}"/>` : ""}
    ${status !== "all" ? `<input type="hidden" name="s" value="${esc(status)}"/>` : ""}
    ${app !== "all" ? `<input type="hidden" name="a" value="${esc(app)}"/>` : ""}
    ${autoRefresh ? `<input type="hidden" name="ar" value="1"/>` : ""}
    <input type="search" name="q" value="${esc(q)}" placeholder="Suche handle / display name / niche / notes…" maxlength="80" style="flex:1;padding:8px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);color:var(--fg);font-size:13px"/>
    <button type="submit" class="btn ghost" style="padding:7px 12px;font-size:12px">Suchen</button>
    ${q ? `<a href="${buildFilterHref(platform, status, app).replace(/&?q=[^&]*/, "")}" class="btn ghost" style="padding:7px 10px;font-size:12px">×</a>` : ""}
  </form>`;

  // Auto-Refresh Toggle. Default OFF; opt-in via ?ar=1.
  const refreshToggle = `<div class="seg" style="margin-left:auto">
    <a href="${(() => {
      const parts: string[] = ["view=outreach", "ar=1"];
      if (platform !== "all") parts.push(`p=${encodeURIComponent(platform)}`);
      if (status !== "all") parts.push(`s=${encodeURIComponent(status)}`);
      if (app !== "all") parts.push(`a=${encodeURIComponent(app)}`);
      if (q) parts.push(`q=${encodeURIComponent(q)}`);
      return `/admin?${parts.join("&")}`;
    })()}" class="${autoRefresh ? "on" : ""}" title="Auto-Refresh alle 15 Sekunden (full-page reload reisst aus Scroll)">15s ⟲</a>
    <a href="${(() => {
      const parts: string[] = ["view=outreach"];
      if (platform !== "all") parts.push(`p=${encodeURIComponent(platform)}`);
      if (status !== "all") parts.push(`s=${encodeURIComponent(status)}`);
      if (app !== "all") parts.push(`a=${encodeURIComponent(app)}`);
      if (q) parts.push(`q=${encodeURIComponent(q)}`);
      return `/admin?${parts.join("&")}`;
    })()}" class="${!autoRefresh ? "on" : ""}" title="Kein Auto-Refresh (Scroll-stabil)">Pause</a>
  </div>`;

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
    <script>
      (function(){
        var f = document.getElementById('outreach-add-form');
        if (!f) return;
        f.addEventListener('submit', function(){
          var picks = Array.from(f.querySelectorAll('input[type=checkbox][name^="for_apps_"]:checked')).map(function(c){return c.value;});
          document.getElementById('for-apps-hidden').value = picks.join(',');
        });
      })();
    </script>
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
  // selected apps. The n8n consumer workflow (next session) picks up
  // queued klar_outreach_runs rows and processes them. Until then the
  // form persists the config but no scraping/sending happens.
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

  // Size-Bucket-Picker (multi-select chips). Maps to follower-ranges in
  // the n8n format-nodes: nano 1k-10k, micro 10k-50k, mid 50k-500k,
  // macro 500k+. Default micro+mid (the proven cold-DM sweet spot).
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

  // Region/Language single-select. One wave = one region (per app). Multi-region
  // was technically safe (UNIQUE on platform+handle + ignore-duplicates blocks
  // double inserts) but suboptimal cost-wise (parallel Apify scrapes with
  // overlapping hashtag pools spend $$ to find duplicates). Radio enforces
  // pick-one in the UI, server-side validation rejects > 1 as defense-in-depth.
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
    <script>
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
    </script>
  </section>`;

  // Run-History compact-Tabelle (letzte 10 Runs). Status-Pill markiert
  // failed/stale visuell, errors-jsonb ist ausklappbar pro Row.
  const STALE_MS = 10 * 60 * 1000;  // running > 10min → "may be stuck"
  const now = Date.now();
  const isStale = (r: OutreachRun) =>
    r.status === "running" && r.started_at &&
    now - new Date(r.started_at).getTime() > STALE_MS;

  // S32-eve: heuristic Phase-Label aus dem existing-state (kein extra DB-Schema).
  // Mappt status + Alter + targets/mails Counters auf eine kompakte Phase-Indikator.
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
    // Wave-Consumer schreibt targets_added/mails_sent erst in Finalize Stats (am Ende),
    // also brauchen wir Heuristik aus age + die finale counters wenn sie kommen.
    if (added === 0 && sent === 0) {
      if (ageSec < 90) return { label: "Apify scraping", tone: "active" };
      if (ageSec < 60 + STALE_MS / 1000) return { label: "Backstop ETA <60s", tone: "wait" };
      return { label: "stale", tone: "warn" };
    }
    if (added > 0 && sent < added) return { label: `sending mails (${sent}/${added})`, tone: "active" };
    if (added > 0 && sent === added) return { label: "finalizing", tone: "active" };
    return null;
  };

  const phasePill = (r: OutreachRun): string => {
    const p = getPhaseLabel(r);
    if (!p) return "";
    const toneMap: Record<typeof p.tone, PillTone> = { wait: "warning", active: "info", done: "success", warn: "danger" };
    return quietPill(p.label, toneMap[p.tone], "font-weight:500;font-size:9px;margin-top:3px;display:inline-block");
  };

  const runStatusPill = (r: OutreachRun): string => {
    const s = r.status;
    if (isStale(r)) return quietPill("stale running", "danger", "font-size:9px");
    const tone: PillTone =
      s === "done" ? "success"
      : s === "running" ? "info"
      : s === "failed" ? "danger"
      : s === "queued" ? "warning"
      : "neutral";
    return quietPill(s, tone, "font-size:9px");
  };

  // Wenn mindestens 1 Welle running ist, hint admin auf den Auto-Refresh-Toggle
  // (default off, opt-in via ?ar=1; siehe S31-Phase3c2 Scroll-Fix-Note).
  const hasRunningWave = runs.some((r) => r.status === "running" || r.status === "queued");

  const runRow = (r: OutreachRun, idx: number): string => {
    const hasDetail = Boolean(
      r.errors ||
      r.status === "failed" ||
      isStale(r) ||
      r.niche ||
      (r.mail_subject && r.mail_subject.length > 0)
    );
    const rowId = `run-${idx}`;
    const expanderBtn = hasDetail
      ? `<button type="button" class="btn ghost" onclick="var d=document.getElementById('${rowId}-detail');d.style.display=d.style.display==='none'?'table-row':'none';" style="padding:2px 7px;font-size:11px;margin-right:6px">▸</button>`
      : `<span style="display:inline-block;width:28px"></span>`;
    const durationStr = r.finished_at && r.started_at
      ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
      : r.status === "running" && r.started_at
        ? `<span class="muted">läuft ${Math.round((now - new Date(r.started_at).getTime()) / 1000)}s</span>`
        : "—";
    const errorsHtml = r.errors
      ? `<pre style="margin:8px 0 0;padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:6px;font-family:var(--font-mono);font-size:11px;color:var(--fg-2);overflow-x:auto;white-space:pre-wrap">${esc(JSON.stringify(r.errors, null, 2))}</pre>`
      : "";
    const sizeBuckets = (r.size_buckets && r.size_buckets.length > 0)
      ? r.size_buckets.join(", ")
      : "—";
    const detailRow = hasDetail
      ? `<tr id="${rowId}-detail" style="display:none"><td colspan="8" style="padding:14px 16px;background:var(--surface-2);border-top:1px solid var(--line)">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;font-size:12px">
            <div><span class="k" style="font-size:9.5px">Buckets</span><div style="font-family:var(--font-mono);margin-top:2px">${esc(sizeBuckets)}</div></div>
            <div><span class="k" style="font-size:9.5px">Niche</span><div style="margin-top:2px">${esc(r.niche ?? "—")}</div></div>
            <div><span class="k" style="font-size:9.5px">Dauer</span><div style="font-family:var(--font-mono);margin-top:2px">${durationStr}</div></div>
            <div><span class="k" style="font-size:9.5px">Run-ID</span><div style="font-family:var(--font-mono);font-size:10px;margin-top:2px">${esc(r.id.slice(0, 8))}…</div></div>
          </div>
          ${r.mail_subject ? `<div style="margin-top:12px"><span class="k" style="font-size:9.5px">Mail-Subject (Override)</span><div style="margin-top:3px;font-family:var(--font-mono);font-size:12px;color:var(--fg-2)">${esc(r.mail_subject)}</div></div>` : ""}
          ${r.errors ? `<div style="margin-top:12px"><span class="k" style="font-size:9.5px;color:var(--danger)">Errors / Notes</span>${errorsHtml}</div>` : ""}
        </td></tr>`
      : "";
    return `<tr>
        <td>${expanderBtn}<span class="muted" style="font-size:11px;white-space:nowrap">${fmtRelative(r.created_at)}</span></td>
        <td>${(r.apps ?? []).map((a) => `<span class="pill" style="font-size:9px;padding:1px 6px">${esc(a)}</span>`).join(" ")}</td>
        <td><span class="pill" style="font-size:9px;padding:1px 6px;text-transform:uppercase">${esc(r.language ?? "de")}</span></td>
        <td>${(r.platforms ?? []).map((p) => `<span class="pill" style="font-size:9px;padding:1px 6px">${esc(p)}</span>`).join(" ")}</td>
        <td class="r">${r.count_per_app}/App</td>
        <td class="r">${r.cost_estimate_usd != null ? "$" + Number(r.cost_estimate_usd).toFixed(2) : "—"}${r.cost_actual_usd != null ? `<div class="muted" style="font-size:10px">actual $${Number(r.cost_actual_usd).toFixed(2)}</div>` : ""}</td>
        <td class="r">${r.targets_added} / ${r.mails_sent} ✉<div class="muted" style="font-size:10px">${durationStr === "—" ? "" : durationStr}</div></td>
        <td>${runStatusPill(r)}${phasePill(r) ? `<div>${phasePill(r)}</div>` : ""}</td>
      </tr>${detailRow}`;
  };

  const runRows = runs.length === 0
    ? `<tr><td colspan="7" class="muted" style="font-style:italic">noch keine Wellen gestartet</td></tr>`
    : runs.map(runRow).join("");
  const refreshHint = hasRunningWave
    ? `<div style="font-size:11px;color:var(--fg-2);margin:8px 0 4px;padding:6px 10px;background:var(--surface-2);border-radius:6px;border:1px solid var(--line);display:inline-block">
        Eine Welle ist running. Auto-Refresh aktivieren um Progress live zu sehen:
        <a class="applink" href="?view=outreach&amp;ar=1" style="font-weight:600;margin-left:4px">15s live</a>
      </div>`
    : "";
  const runsTable = `<h2>Letzte Wellen</h2>
    ${refreshHint}
    <table>
      <thead><tr><th>Wann</th><th>Apps</th><th>Region</th><th>Platforms</th><th class="r">Count</th><th class="r">Cost</th><th class="r">Output / Dauer</th><th>Status / Phase</th></tr></thead>
      <tbody>${runRows}</tbody>
    </table>`;

  // ===== Targets nach App + Status (Angefragt / Reply / Angenommen) =====
  // Per-App-Buckets bündeln die Pipeline-Outputs in den drei Kern-States
  // die der Admin sehen will: wer wurde kontaktiert, wer hat geantwortet,
  // wer ist Affiliate geworden. Targets mit mehreren for_apps[]-Slugs
  // erscheinen in jedem zugehörigen App-Block.
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
  // sort each bucket newest-touched first
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
  // Zeigt Account-Wide-Spend des aktuellen Billing-Cycle (alle Apify-Aktoren,
  // nicht nur Klar-Wellen) + Cap aus dem Paid-Plan. Wenn Token fehlt:
  // fallback-Card mit Hinweis. 5min Cache via next.revalidate (siehe lib).
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
  // Free-Tier-Cap ist hardcoded 300/day (Brevo exposed das nicht via API). Reset
  // 00:00 UTC. Cache 60s im lib. Fallback-Card wenn BREVO_API_KEY env fehlt.
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

  // Klar-Wellen-Cost-Tracker: nur die Klar-Wellen-Anteile aus klar_outreach_runs.
  // Free-Tier-Bezug ist raus (User hat Paid-Plan). Brevo bleibt bei 300/Tag.
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

  // Suppression-Section: collapsed `<details>`. Mini-Add-Form + Tabelle der
  // letzten 20 Einträge. n8n-Wave-Consumer ruft /api/outreach/check-suppression
  // vor jedem Brevo-Send. Reasons sind enforced via DB-CHECK + UI-select.
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

  // ===== Eingegangene Antworten (Reply-Inbox) =====
  // Prominenter Block ganz oben: voller Reply-Text, Übersetzung nach DE,
  // Antwort-Composer (Vorlage oder frei) und die EXPLIZITE Annehmen-Aktion.
  // Kernregel (User): eine Antwort allein nimmt niemanden an — das passiert
  // erst über den grünen Annehmen-Button (mintet dann den Onboarding-Link).
  const replyTargets = allTargets
    .filter((t) => t.status === "replied")
    .filter((t) => showTests || !isTestTarget(t))
    .sort((a, b) => {
      const ax = new Date(a.last_message_at || a.replied_at || a.updated_at).getTime();
      const bx = new Date(b.last_message_at || b.replied_at || b.updated_at).getTime();
      return bx - ax;
    });
  // "Offene Anfragen": bereits kontaktiert (dm_sent / mail1/2_sent), aber noch
  // keine Antwort und nicht in einem Endzustand. Gleiche Karten-Optik wie die
  // Replies, damit man den Eingangs-Look an echten Daten sieht. Aktionen sind
  // real (Nachfassen-Mail / Annehmen / Ablehnen). Auf 24 gedeckelt.
  const TERMINAL = new Set(["replied", "converted", "declined", "dead"]);
  const openTargets = allTargets
    .filter(
      (t) =>
        !TERMINAL.has(t.status) &&
        (t.status === "dm_sent" ||
          t.mail_status === "mail1_sent" ||
          t.mail_status === "mail2_sent"),
    )
    .filter((t) => showTests || !isTestTarget(t))
    .sort((a, b) => {
      const ax = new Date(a.last_mail_at || a.mail1_sent_at || a.contacted_at || a.updated_at).getTime();
      const bx = new Date(b.last_mail_at || b.mail1_sent_at || b.contacted_at || b.updated_at).getTime();
      return bx - ax;
    })
    .slice(0, 24);

  const LANG_OK = /^(de|en|fr|es|it|nl|pt|pl)$/;
  // mode "reply" = echte Antwort eingegangen; "awaiting" = kontaktiert, noch
  // keine Antwort (gleiche Optik, aber kein Reply-Text/Übersetzung, Composer
  // standardmäßig zugeklappt = "Nachfassen").
  const replyCard = (t: OutreachTarget, mode: "reply" | "awaiting" = "reply"): string => {
    const awaiting = mode === "awaiting";
    const name = t.display_name || t.handle;
    const tplLang = replyLang(t.language);
    const acceptLang = LANG_OK.test((t.language ?? "").toLowerCase())
      ? (t.language ?? "de").toLowerCase()
      : "de";
    const def = REPLY_TEMPLATES[tplLang][0];
    const subst = (s: string): string =>
      s.replace(/\{\{name\}\}/g, name).replace(/\{\{handle\}\}/g, t.handle);
    const cleanSub = (t.reply_subject ?? "").replace(/^re:\s*/i, "").trim();
    const defSubject = cleanSub ? `Re: ${cleanSub}` : subst(def.subject);
    const defBody = subst(def.body);
    const rawForTrans = `${t.reply_subject ? t.reply_subject + "\n\n" : ""}${t.last_message ?? ""}`.trim();
    const fLabel = t.follower_estimate
      ? t.follower_estimate >= 1_000_000
        ? `${(t.follower_estimate / 1_000_000).toFixed(1)}M`
        : t.follower_estimate >= 1_000
          ? `${Math.round(t.follower_estimate / 1_000)}k`
          : String(t.follower_estimate)
      : "";
    const profileLink = t.profile_url
      ? `<a class="applink" href="${esc(t.profile_url)}" target="_blank" rel="noopener" style="font-weight:700">@${esc(t.handle)}</a>`
      : `<span style="font-weight:700">@${esc(t.handle)}</span>`;
    const platLabel = t.platform === "tiktok" ? "TikTok" : "Instagram";
    const hasEmail = Boolean(t.contact_email);
    const toEmail = t.contact_email ?? "";
    const whenRel = awaiting
      ? fmtRelative(t.last_mail_at || t.mail1_sent_at || t.contacted_at || t.updated_at)
      : fmtRelative(t.last_message_at || t.replied_at || t.updated_at);

    // Annehmen: App-Auswahl aus for_apps[] (fallback alle Apps).
    const acceptApps = t.for_apps && t.for_apps.length > 0 ? t.for_apps : KLAR_APPS.map((a) => a.slug);
    const appField =
      acceptApps.length === 1
        ? `<input type="hidden" name="app" value="${esc(acceptApps[0])}"/><span class="muted" style="font-size:11px;font-family:var(--font-mono)">App: <strong>${esc(acceptApps[0])}</strong></span>`
        : `<label style="font-size:11px;color:var(--fg-3);display:inline-flex;align-items:center;gap:4px">App
            <select name="app" style="padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px">
              ${acceptApps.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("")}
            </select>
          </label>`;

    // Eingehende Reply (mode "reply") bzw. "noch keine Antwort"-Hinweis
    // (mode "awaiting").
    const incoming = awaiting
      ? `<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:6px;padding:10px 12px;margin:10px 0">
          <div class="muted" style="font-size:12px;font-style:italic">Noch keine Antwort. Kontaktiert ${esc(whenRel)}${t.mails_sent ? ` · ${t.mails_sent} Mail(s) gesendet` : ""}. Sobald geantwortet wird, erscheint hier der volle Text mit Übersetzen-Button.</div>
        </div>`
      : `<div style="background:var(--surface-2);border:1px solid var(--line-strong);border-radius:6px;padding:10px 12px;margin:10px 0">
          ${t.reply_subject ? `<div style="font-weight:600;font-size:12px;margin-bottom:4px">${esc(t.reply_subject)}</div>` : ""}
          ${
            t.last_message
              ? `<div class="reply-incoming" data-raw="${esc(rawForTrans)}" data-src-lang="${esc(tplLang)}" style="white-space:pre-wrap;font-size:13px;color:var(--fg);font-family:var(--font-body)">${esc(t.last_message)}</div>`
              : `<div class="muted" style="font-size:12px;font-style:italic">Kein Reply-Text erfasst (Status wurde manuell auf "Antwort" gesetzt).</div>`
          }
          ${
            t.last_message
              ? `<div style="margin-top:8px"><button type="button" class="btn ghost" style="padding:3px 9px;font-size:11px" onclick="klarTranslate(this)">DE übersetzen</button><div class="reply-trans muted" style="margin-top:6px;font-size:12px;white-space:pre-wrap"></div></div>`
              : ""
          }
        </div>`;

    // Antwort-Composer.
    const composer = `<details ${awaiting ? "" : "open"} style="margin-top:4px">
      <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--fg-2);user-select:none">${awaiting ? "Nachfassen (Mail)" : "Antworten (Mail)"}</summary>
      <form method="POST" action="/admin/outreach/reply" style="margin-top:10px;display:flex;flex-direction:column;gap:8px" data-klar-confirm="Mail geht sofort an ${esc(toEmail)}. Status bleibt ${awaiting ? "unverändert (kontaktiert)" : "auf 'Antwort'"}, der Influencer wird dadurch NICHT angenommen." data-klar-confirm-title="${awaiting ? "Nachfass-Mail" : "Antwort"} an @${esc(t.handle)} senden?" data-klar-confirm-ok="Senden">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <input type="hidden" name="to" value="${esc(toEmail)}"/>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <label style="font-size:11px;color:var(--fg-3);display:inline-flex;align-items:center;gap:4px">Vorlage
            <select onchange="klarReplyFill(this)" style="padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px">
              ${replyTemplateSelectOptions(tplLang)}
            </select>
          </label>
          <span class="muted" style="font-size:11px">an ${hasEmail ? esc(toEmail) : "—"}</span>
        </div>
        <input type="text" name="subject" class="reply-subj" value="${esc(defSubject)}" maxlength="300" placeholder="Betreff" style="padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
        <textarea name="body" class="reply-text" rows="9" maxlength="8000" style="padding:8px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical">${esc(defBody)}</textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button type="submit" class="btn" style="padding:6px 14px;font-size:12px"${hasEmail ? "" : " disabled title=\"keine contact_email hinterlegt\""}>Senden</button>
          <button type="button" class="btn ghost" style="padding:6px 12px;font-size:12px" onclick="klarCopyDraft(this)">Entwurf kopieren</button>
          ${hasEmail ? "" : `<span class="muted" style="font-size:11px;font-style:italic">keine Email → nutze "Entwurf kopieren"</span>`}
        </div>
      </form>
    </details>`;

    // Entscheidung: Annehmen / Ablehnen / Dead.
    const decision = `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <form method="POST" action="/admin/outreach/accept" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" data-klar-confirm="Mintet das Setup${hasEmail ? " und schickt (falls angehakt) den Onboarding-Link per Mail" : ""} und setzt @${esc(t.handle)} auf 'Angenommen'. Erst hierdurch wird der Influencer Affiliate." data-klar-confirm-title="@${esc(t.handle)} als Affiliate annehmen?" data-klar-confirm-ok="Annehmen">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <input type="hidden" name="handle" value="${esc(t.handle)}"/>
        <input type="hidden" name="email" value="${esc(toEmail)}"/>
        <input type="hidden" name="display_name" value="${esc(t.display_name ?? "")}"/>
        <input type="hidden" name="language" value="${esc(acceptLang)}"/>
        ${appField}
        ${hasEmail ? `<label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--fg-2);cursor:pointer"><input type="checkbox" name="send_mail" checked/>Onboarding-Mail senden</label>` : ""}
        <button type="submit" class="btn" style="padding:6px 14px;font-size:12px">Als Affiliate annehmen</button>
      </form>
      <form method="POST" action="/admin/outreach/decline" style="display:inline" data-klar-confirm="Status → declined. @${esc(t.handle)} wird in zukünftigen Wellen übersprungen (Suppression)." data-klar-confirm-title="@${esc(t.handle)} ablehnen?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Ablehnen">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <input type="hidden" name="suppress" value="1"/>
        <button type="submit" class="btn ghost" style="padding:6px 11px;font-size:12px">Ablehnen</button>
      </form>
      <form method="POST" action="/admin/outreach/update" style="display:inline" data-klar-confirm="Status → dead (Antwort nicht verwertbar, kein Interesse)." data-klar-confirm-title="@${esc(t.handle)} auf Dead?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Dead setzen">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <input type="hidden" name="status" value="dead"/>
        <button type="submit" class="btn ghost" style="padding:6px 11px;font-size:12px">Dead</button>
      </form>
    </div>`;

    return `<div class="reply-card" data-name="${esc(name)}" data-handle="${esc(t.handle)}" style="background:var(--surface);border:1px solid var(--line-strong);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow-sm)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${profileLink}
          <span class="pill" style="font-size:9px;padding:1px 6px">${platLabel}</span>
          ${awaiting ? `<span class="pill" style="font-size:8px;padding:1px 5px">wartet</span>` : ""}
          ${fLabel ? `<span class="muted" style="font-size:11px;font-family:var(--font-mono)">${esc(fLabel)}</span>` : ""}
          ${t.display_name ? `<span class="muted" style="font-size:11px">${esc(t.display_name)}</span>` : ""}
          ${(t.for_apps ?? []).map((a) => `<span class="pill" style="font-size:8px;padding:1px 5px">${esc(a)}</span>`).join(" ")}
        </div>
        <div class="muted" style="font-size:11px;font-family:var(--font-mono);white-space:nowrap">${esc(whenRel)} · ${esc(tplLang.toUpperCase())}${hasEmail ? ` · ${esc(toEmail)}` : " · keine Email"}</div>
      </div>
      ${incoming}
      ${composer}
      ${decision}
    </div>`;
  };

  const repliesInbox =
    replyTargets.length === 0
      ? `<h2 style="margin-top:8px">Eingegangene Antworten</h2>
        <p class="sub muted" style="margin:0 0 8px">Keine offenen Antworten. Sobald ein Influencer auf eine Welle antwortet, erscheint er hier mit vollem Text, Übersetzung und Antwort-Composer. <strong>Antwort heisst nicht angenommen</strong>: annehmen passiert erst über den grünen Button.</p>`
      : `<h2 style="margin-top:8px">Eingegangene Antworten <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${replyTargets.length} offen · Antwort ≠ angenommen</span></h2>
        <p class="sub muted" style="margin:0 0 14px">Voller Reply-Text, Übersetzung nach DE, Antwort per Vorlage oder frei. Der Onboarding-Link geht erst über "Als Affiliate annehmen" raus.</p>
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:8px">
          ${replyTargets.map((t) => replyCard(t)).join("")}
        </div>`;

  // Offene Anfragen in derselben Karten-Optik (kontaktiert, wartet auf Antwort).
  const openInbox =
    openTargets.length === 0
      ? ""
      : `<h2 style="margin-top:18px">Offene Anfragen <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${openTargets.length} kontaktiert · wartet auf Antwort</span></h2>
        <p class="sub muted" style="margin:0 0 14px">Bereits angeschriebene Influencer ohne Antwort, in derselben Optik wie ein echter Eingang. Antwortet jemand, wandert die Karte hoch zu "Eingegangene Antworten" mit vollem Text und Übersetzen-Button. Hier kannst du nachfassen, direkt annehmen oder ablehnen.</p>
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:8px">
          ${openTargets.map((t) => replyCard(t, "awaiting")).join("")}
        </div>`;

  // Shared Inbox-JS einmal einbinden, sobald irgendeine Sektion Karten zeigt.
  const inboxJs =
    replyTargets.length > 0 || openTargets.length > 0
      ? `<script>${REPLY_INBOX_JS}</script>`
      : "";

  return `${refreshMeta}<h1>Outreach</h1>
    <p class="sub">Influencer-Outreach-Tracker. <em>Queued → DM gesendet → Antwort → Converted</em>. Auto-Refresh ${autoRefresh ? "alle 15s" : "aus"}, Daten aus Supabase anime-vault.</p>
    ${apifyAccCard}
    ${brevoQuotaCard}
    ${cards}
    ${costCard}
    ${repliesInbox}
    ${openInbox}
    ${inboxJs}
    ${waveForm}
    <div style="margin:32px 0 16px;border-top:1px solid var(--line)"></div>
    ${runsTable}
    <div style="margin:32px 0 16px;border-top:1px solid var(--line)"></div>
    ${targetsByAppSection}
    <div style="margin:32px 0 16px;border-top:1px solid var(--line)"></div>
    ${addForm}
    <h2>Filter</h2>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;align-items:center">
      ${searchForm}
      ${refreshToggle}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">${segPlatform}${segStatus}</div>
    <div style="margin-bottom:18px">${segApp}</div>
    <h2>Targets <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${rows.length} angezeigt${q ? ` · Suche: <em>${esc(q)}</em>` : ""}</span></h2>
    ${testsToggle}
    <table>
      <thead><tr><th>Lead</th><th>Plattform</th><th class="r">Follower</th><th class="r">Views</th><th>Apps</th><th>Status</th><th class="r">Aktionen</th></tr></thead>
      <tbody>${tableBody}</tbody>
    </table>
    ${suppressionSection}`;
}

// Heuristik: Eintrag stammt vermutlich aus internem Self-Test.
// Halten wir bewusst eng (Owner-Email + bekannte Test-Handles), damit ein
// echter Influencer mit "test" im Namen nicht versehentlich versteckt wird.
const isTestInquiry = (r: Inquiry): boolean => {
  const email = (r.email ?? "").toLowerCase();
  const handle = (r.handle ?? "").toLowerCase();
  if (email === "alainkessler04@gmail.com") return true;
  if (handle.includes("selftest") || handle === "klar_test" || handle === "@bombo") return true;
  return false;
};

async function inboxView(typeFilter: string, sourceFilter: string, showDeclined: boolean, showTests: boolean): Promise<string> {
  if (!KLAR_INBOX_KEY)
    return `<h1>Inbox</h1><p class="sub muted">Fast fertig, es fehlt nur der Lese-Key. Setze <span class="warn">KLAR_INBOX_SERVICE_KEY</span> im klar-Vercel-Projekt (Wert: anime-vault &rarr; Settings &rarr; API &rarr; <em>service_role</em>). Optional <span class="warn">KLAR_INBOX_SUPABASE_URL</span>. Anfragen werden schon dauerhaft gespeichert, nur die Anzeige hier braucht den Key.</p>`;
  let rowsAll: Inquiry[] = [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?select=*&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: KLAR_INBOX_KEY,
          Authorization: `Bearer ${KLAR_INBOX_KEY}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!res.ok)
      return `<h1>Inbox</h1><p class="sub muted">Anfragen konnten nicht geladen werden (HTTP ${res.status}). Vermutlich stimmt der hinterlegte service_role-Key nicht.</p>`;
    const j = await res.json();
    rowsAll = Array.isArray(j) ? j : [];
  } catch {
    return `<h1>Inbox</h1><p class="sub muted">Netzwerkfehler beim Laden der Inbox. Einmal neu laden hilft meist.</p>`;
  }

  // Reply-Join: der echte Mail-Body einer Outreach-Reply liegt nur am
  // klar_outreach_targets-Row (last_message), nicht an der Inquiry. Wir laden
  // die Targets und matchen per contact_email (primär) bzw. handle (fallback),
  // damit Affiliate-Karten den vollen Reply-Text + Übersetzen + Antwort-Composer
  // direkt in der Inbox zeigen. Schlägt der Load fehl, bleibt die Karte schlicht.
  const targetsForReply = await listOutreachTargets({ limit: 500 });
  const targetByEmail = new Map<string, OutreachTarget>();
  const targetByHandle = new Map<string, OutreachTarget>();
  for (const t of targetsForReply) {
    const e = (t.contact_email ?? "").toLowerCase().trim();
    if (e && !targetByEmail.has(e)) targetByEmail.set(e, t);
    const h = (t.handle ?? "").toLowerCase().replace(/^@/, "").trim();
    if (h && !targetByHandle.has(h)) targetByHandle.set(h, t);
  }
  const matchTarget = (r: Inquiry): OutreachTarget | null => {
    const e = (r.email ?? "").toLowerCase().trim();
    if (e && targetByEmail.has(e)) return targetByEmail.get(e)!;
    const h = (r.handle ?? "").toLowerCase().replace(/^@/, "").trim();
    if (h && targetByHandle.has(h)) return targetByHandle.get(h)!;
    return null;
  };

  // Filter rows by selected type + source (both default "all"). Declined
  // werden by default ausgeblendet, mit Toggle-Link am Listenende; counts
  // unten zählen aber alle.
  const effectiveType = typeFilter === "consulting" || typeFilter === "affiliate" ? typeFilter : "all";
  const effectiveSource = sourceFilter && sourceFilter !== "all" ? sourceFilter : "all";
  const rows = rowsAll.filter((r) => {
    if (effectiveType !== "all" && r.type !== effectiveType) return false;
    if (effectiveSource !== "all" && (r.source ?? "") !== effectiveSource) return false;
    if (!showDeclined && r.status === "declined") return false;
    if (!showTests && isTestInquiry(r)) return false;
    return true;
  });
  const nTests = rowsAll.filter(isTestInquiry).length;

  // Build aggregate counts so filter tabs/pills show live totals.
  const totalsByType: Record<string, number> = { all: rowsAll.length, affiliate: 0, consulting: 0 };
  const totalsBySource: Record<string, number> = { all: rowsAll.length };
  for (const k of SOURCE_KEYS) totalsBySource[k] = 0;
  totalsBySource["unknown"] = 0;
  let nNew = 0;
  let nDeclined = 0;
  for (const r of rowsAll) {
    if (r.type === "affiliate") totalsByType.affiliate++;
    if (r.type === "consulting") totalsByType.consulting++;
    const s = r.source ?? "";
    if (s && totalsBySource[s] !== undefined) totalsBySource[s]++;
    else if (!s) totalsBySource["unknown"]++;
    else totalsBySource[s] = (totalsBySource[s] ?? 0) + 1;
    if (r.status === "new") nNew++;
    if (r.status === "declined") nDeclined++;
  }

  // Filter UI: type-tabs (Alle / Affiliate / Consulting) + source-pills below.
  const buildHref = (t: string, s: string) =>
    `/admin?view=inbox${t !== "all" ? `&type=${t}` : ""}${s !== "all" ? `&source=${encodeURIComponent(s)}` : ""}${showDeclined ? `&show_declined=1` : ""}${showTests ? `&show_tests=1` : ""}`;
  const tabBtn = (t: string, label: string, count: number) => `<a class="nav ${effectiveType === t ? "on" : ""}" href="${buildHref(t, effectiveSource)}" style="padding:8px 14px;border-radius:8px">${esc(label)} <span class="muted" style="margin-left:6px;font-size:11px">${count}</span></a>`;
  const typeTabs = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px 0">
    ${tabBtn("all", "Alle", totalsByType.all)}
    ${tabBtn("affiliate", "Affiliate", totalsByType.affiliate)}
    ${tabBtn("consulting", "Consulting", totalsByType.consulting)}
  </div>`;
  const sourceBtn = (s: string, label: string, count: number) => {
    const on = effectiveSource === s;
    const styleOn = `background:var(--fg);color:var(--accent-fg);border:1px solid var(--fg)`;
    return `<a href="${buildHref(effectiveType, s)}" class="pill" style="${on ? styleOn : ""};font-size:11px;padding:5px 10px;text-decoration:none">${esc(label)} <span style="opacity:0.6;margin-left:4px">${count}</span></a>`;
  };
  const sourceFilters = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px 0;align-items:center">
    <span class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-right:4px">Quelle</span>
    ${sourceBtn("all", "Alle", totalsBySource.all)}
    ${SOURCE_KEYS.map((s) => sourceBtn(s, SOURCE_META[s].label, totalsBySource[s] ?? 0)).join("")}
    ${totalsBySource["unknown"] ? sourceBtn("unknown", "Ohne Quelle", totalsBySource["unknown"]) : ""}
  </div>`;

  // Cards: when an explicit type is selected, split by source for that type;
  // otherwise show the high-level type breakdown.
  const cardsByType = `<div class="cards">
    <div class="card"><div class="k">Neu</div><div class="v">${nNew}</div><div class="s">ungelesen</div></div>
    <div class="card"><div class="k">Affiliate</div><div class="v">${totalsByType.affiliate}</div><div class="s">Anfragen</div></div>
    <div class="card"><div class="k">Consulting</div><div class="v">${totalsByType.consulting}</div><div class="s">Anfragen</div></div>
    <div class="card"><div class="k">Gesamt</div><div class="v">${totalsByType.all}</div><div class="s">letzte 200</div></div>
  </div>`;
  const sourceCountForType = (t: string, s: string) => rowsAll.filter((r) => r.type === t && (r.source ?? "") === s).length;
  const cardsBySource = effectiveType !== "all"
    ? `<div class="cards">
        ${SOURCE_KEYS.map((s) => `<div class="card"><div class="k">${esc(SOURCE_META[s].label)}</div><div class="v">${sourceCountForType(effectiveType, s)}</div><div class="s">${esc(effectiveType === "affiliate" ? "Affiliate" : "Consulting")}</div></div>`).join("")}
      </div>`
    : "";
  const cards = `${cardsByType}${cardsBySource}`;

  const fmt = (s: unknown) => {
    const d = new Date(String(s));
    return isNaN(d.getTime())
      ? esc(s)
      : d.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
  };

  // Per-card details as label/value-pairs (vs. flat string joined by middots
  // in the old table layout). Empty values are skipped — `why` and `brief`
  // get extra room because they are usually multi-sentence.
  const detailPairs = (r: Inquiry): Array<[string, string | undefined, boolean]> =>
    r.type === "affiliate"
      ? [
          ["Handle", r.handle, false],
          ["Audience", r.audience, false],
          ["Plattformen", r.platforms, false],
          ["Warum", r.why, true],
        ]
      : [
          ["Name", r.name, false],
          ["Projekt", r.project, false],
          ["Budget", r.budget, false],
          ["Brief", r.brief, true],
        ];

  // Apps that are wired up (KLAR_ADMIN_APPS env). Used to populate the
  // approve-form select. If KLAR_ADMIN_APPS is empty, the dropdown still
  // shows but submitting will return "unknown app" — that's the cue to add
  // the app's slug+serviceKey to the env first.
  const allWiredApps = getApps();
  const statusBySlug = new Map(KLAR_APPS.map((a) => [a.slug, a.status]));
  const wiredOptionsFor = (target: string | undefined): string =>
    allWiredApps
      .map((a) => {
        const status = statusBySlug.get(a.slug);
        const suffix = status ? ` · ${status}` : "";
        return `<option value="${esc(a.slug)}"${a.slug === target ? " selected" : ""}>${esc(a.name)}${suffix}</option>`;
      })
      .join("");

  // Onboarding-Link delegated to lib/adminApps.setupLandingUrl() so there is
  // exactly one place that knows the per-app host.
  const setupLinkFor = (slug: string, token: string): string => setupLandingUrl(slug, token);

  // Action-block per card: either the approved-link readout (if already
  // invited/active) or a collapsible approve-form (only for affiliate type
  // and only if still actionable). Collapsible defaults to open for "new"
  // so the admin sees the form immediately on first contact.
  // Reject-Button: in einer Zeile mit Approve-Klappbereich, dezent. Setzt
  // status='declined' (+ optional reason). Reopen kehrt auf 'new' zurück.
  const declineForm = (r: Inquiry): string => {
    if (!r.id) return "";
    if (r.status === "declined") {
      return `<form method="POST" action="/admin/decline" style="display:inline">
        <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
        <input type="hidden" name="action" value="reopen"/>
        <button type="submit" class="btn ghost" style="padding:6px 12px;font-size:11px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.04em" title="Status wieder auf 'neu' setzen">↺ Wieder öffnen</button>
      </form>`;
    }
    if (r.status === "new") {
      return `<details style="display:inline-block">
        <summary style="cursor:pointer;padding:6px 12px;font-size:11px;font-family:var(--font-mono);font-weight:600;color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em;border:1px solid var(--line);border-radius:6px;user-select:none;list-style:none">Ablehnen</summary>
        <form method="POST" action="/admin/decline" style="display:flex;gap:6px;align-items:center;margin-top:8px;padding:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px" data-klar-confirm="Status wird auf 'abgelehnt' gesetzt. Mit ↺ jederzeit wieder öffnen." data-klar-confirm-title="Anfrage ablehnen?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Ablehnen">
          <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
          <input type="hidden" name="action" value="decline"/>
          <input type="text" name="reason" maxlength="280" placeholder="Grund (optional, intern)" style="padding:5px 8px;font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:5px;color:var(--fg);min-width:220px"/>
          <button type="submit" class="btn ghost" style="padding:5px 11px;font-size:11px">Ablehnen</button>
        </form>
      </details>`;
    }
    return "";
  };

  const actionBlock = (r: Inquiry): string => {
    // Declined: nur Reopen-Button + ggf. Reason-Hinweis.
    if (r.status === "declined") {
      const reasonLine = r.decline_reason
        ? `<div class="muted" style="margin-top:4px;font-size:11px;font-style:italic">Grund: ${esc(r.decline_reason)}</div>`
        : "";
      return `<div style="margin-top:14px;padding:10px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="font-size:12px;color:var(--fg-3)">Abgelehnt${r.declined_at ? ` ${fmt(r.declined_at)}` : ""}.${reasonLine}</div>
        ${declineForm(r)}
      </div>`;
    }
    if (r.type !== "affiliate") {
      // Consulting/Coaching: nur Reject-Button (kein Approve-Flow).
      const fr = declineForm(r);
      return fr ? `<div style="margin-top:14px">${fr}</div>` : "";
    }

    if ((r.status === "invited" || r.status === "approved" || r.status === "active") && r.approved_app && r.approved_code) {
      const link = setupLinkFor(r.approved_app, r.approved_code);
      const isLive = r.status === "active";
      return `<div style="margin-top:14px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${quietPill(`${isLive ? "active" : "invited"} · ${r.approved_app}`, isLive ? "success" : "info")}
          <a class="applink" style="font-family:ui-monospace,monospace;font-size:11px;word-break:break-all;flex:1;min-width:200px" href="${link}" target="_blank" rel="noopener">${link} ↗</a>
          <button type="button" class="btn ghost" style="padding:5px 11px;font-size:11px;flex-shrink:0" onclick="navigator.clipboard.writeText('${link}').then(()=>this.textContent='✓ kopiert').catch(()=>this.textContent='copy failed')">Copy link</button>
        </div>
        ${r.approved_at ? `<div class="muted" style="margin-top:6px;font-size:11px">Approved ${fmt(r.approved_at)}</div>` : ""}
      </div>`;
    }

    if (!r.id) return "";
    const displayName = r.handle || (r.email ?? "").split("@")[0] || "";
    const isNew = r.status === "new";
    return `<details style="margin-top:14px"${isNew ? " open" : ""}>
      <summary style="cursor:pointer;padding:8px 0;font-size:11px;color:var(--fg-2);font-weight:700;text-transform:uppercase;letter-spacing:0.6px;user-select:none">▸ Approve · Onboarding-Link generieren</summary>
      <form method="POST" action="/admin/approve" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;margin-top:6px">
        <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
        <input type="hidden" name="email" value="${esc(r.email ?? "")}"/>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          App ${r.target_app ? `<span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">· wish: ${esc(r.target_app)}</span>` : ""}
          <select name="app" required style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px">
            <option value="" ${r.target_app ? "" : "disabled selected"}>— wählen —</option>
            ${wiredOptionsFor(r.target_app)}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Handle
          <input type="text" name="handle" required maxlength="64" value="${esc((r.handle ?? "").replace(/^@/, ""))}" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:140px"/>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Display
          <input type="text" name="display_name" maxlength="64" value="${esc(displayName)}" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:160px"/>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Lang
          <select name="language" required style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:70px">
            <option value="de" selected>DE</option>
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="es">ES</option>
            <option value="it">IT</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Share %
          <input type="number" name="share_pct" min="1" max="100" step="1" value="50" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:70px"/>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Months
          <input type="number" name="share_months" min="1" max="60" step="1" value="24" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:70px"/>
        </label>
        <button type="submit" class="btn" style="padding:8px 16px;font-size:13px">Onboarding-Link →</button>
      </form>
    </details>
    <div style="margin-top:10px">${declineForm(r)}</div>`;
  };

  // Per-card status pill (top right corner). "new" affiliate gets a vivid
  // amber-yellow so unread requests catch the eye in a long list.
  const statusPillFor = (r: Inquiry): string => {
    const s = r.status ?? "";
    const tone: PillTone = s === "active" ? "success" : (s === "invited" || s === "approved") ? "info" : s === "new" ? "warning" : "neutral";
    const label = s === "active" ? "active" : (s === "invited" || s === "approved") ? "invited" : s === "new" ? "neu" : s === "declined" ? "abgelehnt" : (s || "—");
    return quietPill(label, tone);
  };

  const typePillFor = (t: string | undefined): string =>
    quietPill(t === "affiliate" ? "Affiliate" : t === "consulting" ? "Consulting" : (t ?? "—"), t === "affiliate" ? "accent" : "neutral", "text-transform:uppercase;font-size:10px;letter-spacing:0.6px");

  // Initials-Avatar: ruhiger, token-basierter Neutral-Anker (keine Regenbogen-
  // Hues mehr). Die Initialen differenzieren die Person, nicht die Farbe.
  const avatarFor = (email: string): string => {
    const local = (email || "?").split("@")[0] || "?";
    const letters = local.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || local.slice(0, 2).toUpperCase();
    return `<div aria-hidden="true" style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:var(--surface-2);color:var(--fg-2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:14px;letter-spacing:0.02em">${esc(letters)}</div>`;
  };

  // Status-Indikator oben rechts: gedämpfter Token-Ton, pulsierender Punkt nur
  // für "neu". Keine Emoji.
  const statusBadgeFor = (r: Inquiry): string => {
    const base = "display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;font-family:var(--font-mono);letter-spacing:.04em;text-transform:uppercase";
    if (r.status === "active") return `<span style="${base};color:var(--success)">active</span>`;
    if (r.status === "invited" || r.status === "approved") return `<span style="${base};color:var(--info)">invited</span>`;
    if (r.status === "new") return `<span style="${base};color:var(--warning)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--warning);animation:klar-pulse 1.6s infinite"></span>neu</span>`;
    if (r.status === "declined") return `<span style="${base};color:var(--fg-4)">abgelehnt</span>`;
    return `<span style="font-size:11px;font-family:var(--font-mono);color:var(--fg-3);letter-spacing:.04em;text-transform:uppercase">${esc(r.status ?? "")}</span>`;
  };

  // Inline-Type-Badge: ruhiges Mono-Pill, neutral getönt (vorher laut violett/pink).
  const typeBadgeMini = (t: string | undefined): string => {
    const label = t === "affiliate" ? "affiliate" : t === "consulting" ? "consulting" : (t ?? "—");
    return `<span style="font-family:var(--font-mono);font-size:10.5px;font-weight:600;color:var(--fg-2);background:var(--surface-2);border:1px solid var(--line);padding:3px 9px;border-radius:999px;letter-spacing:.02em">${esc(label)}</span>`;
  };

  // Reply-Block für eine Inbox-Karte mit gematchtem Outreach-Target: voller
  // Mail-Body + Übersetzen + Antwort-Composer (Vorlage/frei → /admin/outreach/reply,
  // ändert den Status NICHT). Approve/Onboarding bleibt separat im actionBlock.
  let hasReplyComposer = false;
  const inboxReplyBlock = (r: Inquiry, t: OutreachTarget): string => {
    const tplLang = replyLang(t.language);
    const handle = ((t.handle || r.handle) ?? "").replace(/^@/, "");
    const name = t.display_name || r.handle || t.handle || "";
    const toEmail = ((t.contact_email || r.email) ?? "").toLowerCase().trim();
    const hasEmail = Boolean(toEmail);
    const rawForTrans = `${t.reply_subject ? t.reply_subject + "\n\n" : ""}${t.last_message ?? ""}`.trim();
    const def = REPLY_TEMPLATES[tplLang][0];
    const subst = (s: string): string => s.replace(/\{\{name\}\}/g, name).replace(/\{\{handle\}\}/g, handle);
    const cleanSub = (t.reply_subject ?? "").replace(/^re:\s*/i, "").trim();
    const defSubject = cleanSub ? `Re: ${cleanSub}` : subst(def.subject);
    const defBody = subst(def.body);
    const platLabel = t.platform === "tiktok" ? "TikTok" : t.platform === "instagram" ? "Instagram" : "";
    return `<div class="reply-card" data-name="${esc(name)}" data-handle="${esc(handle)}" style="margin-top:16px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px">
      <div style="font-family:var(--font-mono);font-size:9.5px;font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:var(--fg-4);margin-bottom:8px">Antwort des Influencers${platLabel ? ` · ${platLabel}` : ""}</div>
      ${t.reply_subject ? `<div style="font-weight:600;font-size:12px;margin-bottom:4px">${esc(t.reply_subject)}</div>` : ""}
      <div class="reply-incoming" data-raw="${esc(rawForTrans)}" data-src-lang="${esc(tplLang)}" style="white-space:pre-wrap;font-size:13px;color:var(--fg);font-family:var(--font-body)">${esc(t.last_message ?? "")}</div>
      <div style="margin-top:8px"><button type="button" class="btn ghost" style="padding:3px 9px;font-size:11px" onclick="klarTranslate(this)">DE übersetzen</button><div class="reply-trans muted" style="margin-top:6px;font-size:12px;white-space:pre-wrap"></div></div>
      <details style="margin-top:10px">
        <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--fg-2);user-select:none">Antworten (Mail)</summary>
        <form method="POST" action="/admin/outreach/reply" style="margin-top:10px;display:flex;flex-direction:column;gap:8px" data-klar-confirm="Mail geht sofort an ${esc(toEmail)}. Reine Antwort, Approve/Onboarding-Link bleibt separat unten." data-klar-confirm-title="Antwort an @${esc(handle)} senden?" data-klar-confirm-ok="Senden">
          <input type="hidden" name="id" value="${esc(t.id)}"/>
          <input type="hidden" name="to" value="${esc(toEmail)}"/>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <label style="font-size:11px;color:var(--fg-3);display:inline-flex;align-items:center;gap:4px">Vorlage
              <select onchange="klarReplyFill(this)" style="padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px">
                ${replyTemplateSelectOptions(tplLang)}
              </select>
            </label>
            <span class="muted" style="font-size:11px">an ${hasEmail ? esc(toEmail) : "—"}</span>
          </div>
          <input type="text" name="subject" class="reply-subj" value="${esc(defSubject)}" maxlength="300" placeholder="Betreff" style="padding:7px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px"/>
          <textarea name="body" class="reply-text" rows="8" maxlength="8000" style="padding:8px 10px;border:1px solid var(--line-strong);border-radius:6px;background:var(--bg);color:var(--fg);font-size:13px;font-family:var(--font-body);resize:vertical">${esc(defBody)}</textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button type="submit" class="btn" style="padding:6px 14px;font-size:12px"${hasEmail ? "" : " disabled title=\"keine Email\""}>Senden</button>
            <button type="button" class="btn ghost" style="padding:6px 12px;font-size:12px" onclick="klarCopyDraft(this)">Entwurf kopieren</button>
            ${hasEmail ? "" : `<span class="muted" style="font-size:11px;font-style:italic">keine Email, nutze "Entwurf kopieren"</span>`}
          </div>
        </form>
      </details>
    </div>`;
  };

  const renderCard = (r: Inquiry): string => {
    const details = detailPairs(r)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v, isLong]) => `<div style="display:flex;gap:14px;font-size:13px;line-height:1.55;align-items:${isLong ? "flex-start" : "baseline"};padding:6px 0">
        <span style="min-width:88px;flex-shrink:0;font-family:var(--font-mono);font-weight:500;text-transform:uppercase;letter-spacing:.08em;font-size:9.5px;color:var(--fg-4);padding-top:${isLong ? "4px" : "0"}">${esc(k)}</span>
        <span style="color:var(--fg);flex:1;${isLong ? "white-space:pre-wrap;word-wrap:break-word" : ""}">${esc(v!)}</span>
      </div>`)
      .join("");

    const matched = matchTarget(r);
    let replyBlock = "";
    if (matched && (matched.last_message ?? "").trim()) {
      hasReplyComposer = true;
      replyBlock = inboxReplyBlock(r, matched);
    }

    const isNew = r.status === "new";
    const isDeclined = r.status === "declined";
    return `<article class="inbox-card" style="background:var(--surface);border:1px solid ${isNew ? "var(--line-strong)" : "var(--line)"};border-radius:14px;padding:${isDeclined ? "16px 22px" : "24px 26px"};margin:0;transition:border-color .15s,box-shadow .2s,opacity .15s;position:relative;${isNew ? "box-shadow:0 0 0 1px var(--line-strong) inset;" : ""}${isDeclined ? "opacity:.55;" : ""}">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:18px">
        <div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">
          ${avatarFor(r.email ?? "")}
          <div style="min-width:0;flex:1">
            <a class="applink" href="mailto:${esc(r.email)}" style="font-family:var(--font-display);font-weight:700;font-size:16px;letter-spacing:-.01em;color:var(--fg);border:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.email)}</a>
            <div style="display:flex;align-items:center;gap:10px;margin-top:5px;flex-wrap:wrap">
              ${typeBadgeMini(r.type)}
              ${sourcePill(r.source)}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;text-align:right;flex-shrink:0">
          ${statusBadgeFor(r)}
          <span class="muted" style="font-size:11px;font-family:var(--font-mono);letter-spacing:.02em" title="${esc(fmt(r.created_at))}">${esc(fmtRelative(typeof r.created_at === "string" ? r.created_at : null))}</span>
        </div>
      </header>
      <div style="display:flex;flex-direction:column;gap:0">${details || `<span class="muted" style="font-size:12.5px;font-style:italic">keine weiteren Angaben</span>`}</div>
      ${replyBlock}
      ${actionBlock(r)}
    </article>`;
  };

  const buildToggleHref = (target: "declined" | "tests") => {
    const base = `/admin?view=inbox`;
    const parts: string[] = [];
    if (effectiveType !== "all") parts.push(`type=${effectiveType}`);
    if (effectiveSource !== "all") parts.push(`source=${encodeURIComponent(effectiveSource)}`);
    if (target === "declined" ? !showDeclined : showDeclined) parts.push("show_declined=1");
    if (target === "tests" ? !showTests : showTests) parts.push("show_tests=1");
    return parts.length ? `${base}&${parts.join("&")}` : base;
  };
  const declinedToggle = nDeclined > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background:var(--surface-2);border:1px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span class="muted" style="font-size:12px;font-family:var(--font-mono);letter-spacing:.04em">${showDeclined ? "✕" : "•"} ${nDeclined} abgelehnt${showDeclined ? " (eingeblendet)" : " (versteckt)"}</span>
        <a class="applink" href="${buildToggleHref("declined")}" style="font-size:12px">${showDeclined ? "verstecken" : "zeigen"} →</a>
      </div>`
    : "";
  const testsToggle = nTests > 0
    ? `<div style="margin-top:10px;padding:12px 16px;background:var(--surface-2);border:1px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span class="muted" style="font-size:12px;font-family:var(--font-mono);letter-spacing:.04em">${showTests ? "⚙" : "•"} ${nTests} Test-Eintrag${nTests === 1 ? "" : "e"}${showTests ? " (eingeblendet)" : " (versteckt)"}</span>
        <a class="applink" href="${buildToggleHref("tests")}" style="font-size:12px">${showTests ? "verstecken" : "zeigen"} →</a>
      </div>`
    : "";

  const body = rows.length
    ? `<div style="display:flex;flex-direction:column;gap:14px;margin-top:8px">${rows.map(renderCard).join("")}</div>${testsToggle}${declinedToggle}`
    : `<div style="background:var(--surface);border:1px dashed var(--line);border-radius:14px;padding:48px 24px;text-align:center"><div style="font-family:var(--font-mono);font-size:11px;color:var(--fg-4);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">leer</div><span class="muted" style="font-size:13px">Keine Anfragen in dieser Auswahl.${effectiveType !== "all" || effectiveSource !== "all" ? ` <a class="applink" href="/admin?view=inbox">Filter zurücksetzen</a>` : ""}</span></div>${testsToggle}${declinedToggle}`;

  const consultingHint = effectiveType === "consulting"
    ? `<p class="sub muted" style="margin:0 0 16px;font-size:13px">Consulting-Calls aus Cal.com (consulting + coaching event types) erscheinen unter <a class="applink" href="/admin?view=bookings">Bookings</a>. Hier nur die schriftlichen Anfragen vom Kontaktformular.</p>`
    : "";

  return `<style>
    @keyframes klar-pulse { 0%,100% { box-shadow: 0 0 0 0 #eab308a0; } 50% { box-shadow: 0 0 0 4px transparent; } }
    .inbox-card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); }
    .inbox-card details[open] summary { color: var(--fg); }
  </style><h1>Inbox</h1><p class="sub">Affiliate- und Consulting-Anfragen, gefiltert nach Typ und Quelle. Affiliate-Karten haben den <em>Approve</em>-Klappbereich für den Onboarding-Link, bei neuen Anfragen ist er aufgeklappt. Outreach-Replies zeigen den vollen Mail-Text mit Übersetzen + Antwort-Composer direkt auf der Karte.</p>
    ${typeTabs}
    ${sourceFilters}
    ${consultingHint}
    ${cards}
    ${body}
    ${hasReplyComposer ? `<script>${REPLY_INBOX_JS}</script>` : ""}`;
}

// ============================================================
// Templates View — per-app outreach templates (hashtags + Mail-1/2
// subject+body). Editable per (app_slug, language) row. Used by the
// Wave-Consumer to render Mail-1 and by Apify Discovery for hashtag-
// based crawl seeds. Welle-Starter form pre-fills from these defaults
// when the admin picks a single app + language.
// ============================================================

// templatesView migrated to its own React route at /admin/templates/page.tsx.

// ============================================================
// payoutsView migrated to its own React route at /admin/payouts/page.tsx.

// 303 to a migrated React route, forwarding every query param except `view`.
// The migrated pages render the ?msg= flash, so POST-handler confirmations
// (dispatch/reconcile/suspend/…) that redirect to ?view=<x>&msg=… survive.
function redirectTo(url: URL, target: string): Response {
  const params = new URLSearchParams(url.searchParams);
  params.delete("view");
  const qs = params.toString();
  return new Response(null, {
    status: 303,
    headers: { Location: qs ? `${target}?${qs}` : target },
  });
}

export async function GET(req: Request): Promise<Response> {
  const auth = await checkAuth(req);
  if (!auth.authed) {
    // Misconfigured envs or unknown device or expired session — bounce to
    // the unified login page, which handles all three cases.
    return new Response(null, {
      status: 303,
      headers: { Location: "/admin/login" },
    });
  }

  const url = new URL(req.url);
  const apps = getApps();
  const flash = url.searchParams.get("msg");
  const view = url.searchParams.get("view") || "overview";

  // Overview migrated to its own React route. Bare /admin (default "overview")
  // and explicit ?view=overview both bounce there — single source for the
  // landing view. Other views stay server-rendered here.
  if (view === "overview") {
    return redirectTo(url, "/admin/overview");
  }

  let main: string;
  if (view === "outreach") {
    const p = url.searchParams.get("p") ?? "all";
    const s = url.searchParams.get("s") ?? "all";
    const a = url.searchParams.get("a") ?? "all";
    const q = url.searchParams.get("q") ?? "";
    // Auto-Refresh default-OFF (full-page reload reisst aus Scroll-Position).
    // ?ar=1 schaltet es opt-in ein. Persistiert via URL state.
    const ar = url.searchParams.get("ar") === "1";
    const showTests = url.searchParams.get("show_tests") === "1";
    main = await outreachView(p, s, a, q, ar, showTests);
  }
  else if (view === "inbox") {
    const typeFilter = url.searchParams.get("type") ?? "all";
    const sourceFilter = url.searchParams.get("source") ?? "all";
    const showDeclined = url.searchParams.get("show_declined") === "1";
    const showTests = url.searchParams.get("show_tests") === "1";
    main = await inboxView(typeFilter, sourceFilter, showDeclined, showTests);
  }
  else if (view === "templates") {
    // Templates migrated to its own React route. Keep ?view=templates working
    // for old bookmarks/links by bouncing there.
    return redirectTo(url, "/admin/templates");
  }
  else {
    // Per-app detail migrated to the dynamic route /admin/[app]. A real app
    // slug bounces there (query forwarded so POST-action ?msg= flashes survive);
    // anything else falls back to the overview route.
    const app = apps.find((a) => a.slug === view);
    if (!app) {
      return redirectTo(url, "/admin/overview");
    }
    return redirectTo(url, `/admin/${encodeURIComponent(app.slug)}`);
  }

  return doc(shell(view, apps, flash, main));
}
