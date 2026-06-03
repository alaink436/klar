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

import { getApps, sbGet, setupLandingUrl, listInfluencers, type AdminApp, type InfluencerRow } from "../../lib/adminApps";
import { getTrackingUrl, type BrandKey } from "../affiliate/_shared/brands";
import { KLAR_APPS, type KlarAppMeta } from "../../lib/klarApps";
import {
  getOutreachStats,
  getOutreachPerAppStats,
  listOutreachTargets,
  listOutreachRuns,
  listAppTemplates,
  listSuppressions,
  getOutreachCostSummary,
  isOutreachConfigured,
  type OutreachPlatform,
  type OutreachStatus,
  type OutreachTarget,
  type OutreachRun,
  type AppMailTemplate,
  type PerAppStat,
  type SuppressionRow,
} from "../../lib/outreachStore";
import { getApifyAccountStatus } from "../../lib/apifyAccount";
import { getBrevoQuota } from "../../lib/brevoQuota";
import { REPLY_TEMPLATES, replyLang, type ReplyLang } from "../../lib/replyTemplates";
import { isTranslateConfigured } from "../../lib/translate";
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
} from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// App-Slug → Brand-Key (siehe api/affiliate/complete + affiliate-create).
const APP_TO_BRAND: Record<string, BrandKey> = {
  "yarn-stash": "yarnstash",
  moto: "throttleup",
  wavelength: "wavelength",
  kelva: "kelva",
  trubel: "trubel",
  myloo: "myloo",
};
// Apps deren Tracking über influencer_codes läuft (Shape B). Bei denen ist der
// Tracking-Slug der interne Code, sonst der Handle.
const SHAPE_B_APPS = new Set(["yarn-stash", "moto", "kelva"]);

// Deterministische Code-Ableitung aus dem Handle, identisch zu affiliate-create
// + api/affiliate/complete, damit der Tracking-Link auch ohne gesetztes
// promo_code rekonstruierbar ist.
function deriveCode(handle: string): string {
  const c = handle.toUpperCase().replace(/[^A-Z0-9_.-]/g, "").slice(0, 32);
  return c.length >= 2 ? c : "";
}

// Fertiger Tracking-Link für eine Affiliate-Zeile, oder "" wenn die App keine
// Brand-Zuordnung hat.
function trackingLinkFor(app: AdminApp, row: InfluencerRow): string {
  const brand = APP_TO_BRAND[app.slug];
  if (!brand) return "";
  const slug = SHAPE_B_APPS.has(app.slug)
    ? (row.promo_code || deriveCode(row.handle))
    : row.handle;
  return slug ? getTrackingUrl(brand, slug) : "";
}

// "Affiliate selbst anlegen (DM)"-Formular. App ist implizit (hidden), weil es
// pro App-View gerendert wird. Wird sowohl im Empty-State als auch über der
// Affiliate-Tabelle eingehängt.
function createAffiliateForm(app: AdminApp): string {
  const lab = "display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px";
  const inp = "margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px";
  return `<details style="margin:0 0 22px">
    <summary style="cursor:pointer;padding:9px 14px;background:var(--surface-2);border:1px solid var(--line-strong);border-radius:8px;font-size:11px;color:var(--fg-2);font-weight:700;text-transform:uppercase;letter-spacing:0.6px;user-select:none;display:inline-block">+ Affiliate selbst anlegen (DM)</summary>
    <form method="POST" action="/admin/affiliate-create" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:14px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;margin-top:8px">
      <input type="hidden" name="app" value="${esc(app.slug)}"/>
      <label style="${lab}">Handle<input type="text" name="handle" required maxlength="64" placeholder="username" style="${inp};width:150px"/></label>
      <label style="${lab}">Email <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">· optional</span><input type="email" name="email" maxlength="120" placeholder="leer = nur Link" style="${inp};width:200px"/></label>
      <label style="${lab}">Display<input type="text" name="display_name" maxlength="64" style="${inp};width:150px"/></label>
      <label style="${lab}">Lang<select name="language" style="${inp};width:70px"><option value="de" selected>DE</option><option value="en">EN</option><option value="fr">FR</option><option value="es">ES</option><option value="it">IT</option></select></label>
      <label style="${lab}">Share %<input type="number" name="share_pct" min="1" max="100" step="1" value="50" style="${inp};width:70px"/></label>
      <label style="${lab}">Months<input type="number" name="share_months" min="1" max="60" step="1" value="24" style="${inp};width:70px"/></label>
      <button type="submit" class="btn" style="padding:8px 16px;font-size:13px">Anlegen + Links →</button>
    </form>
    <p class="muted" style="margin:8px 2px 0;font-size:11px;max-width:62ch">Legt einen <strong>pending</strong> Affiliate an und mintet den Tracking-Link sofort. Auszahlungsdaten holt der Influencer übers Onboarding nach. Mit Email geht die Onboarding-Mail automatisch raus, ohne Email bekommst du nur den Link zum Reinpasten in die DM.</p>
  </details>`;
}

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
function sourcePill(s: string | undefined): string {
  if (!s) return `<span class="pill muted" style="font-size:10px">unbekannt</span>`;
  const m = SOURCE_META[s];
  if (!m) return `<span class="pill" style="font-size:10px">${esc(s)}</span>`;
  return `<span class="pill" style="background:${m.bg};color:${m.fg};border:1px solid ${m.fg}22;font-size:10px;font-weight:600">${esc(m.label)}</span>`;
}

interface CalBooking {
  cal_uid?: string;
  trigger_event?: string;
  event_type_slug?: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  attendee_email?: string;
  attendee_name?: string;
  location?: string;
  status?: string;
  created_at?: string;
}

// Klar Studio is CH-based, payouts run through Wise from a CHF balance.
// DB columns are still named `*_eur_cents` for historical reasons (Wavelength's
// richer schema established the name first); semantically they hold the
// reporting currency configured below.
const REPORTING_CURRENCY = process.env.KLAR_REPORTING_CURRENCY ?? "CHF";
const money = (c: number | null | undefined) =>
  (Number(c ?? 0) / 100).toLocaleString("de-CH", {
    style: "currency",
    currency: REPORTING_CURRENCY,
  });
// Back-compat alias so existing eur() callsites stay valid.
const eur = money;

// STYLE moved to ./_shared.ts so /admin/analytics can reuse it.

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
  const item = (v: string, label: string, icon: string, href?: string) =>
    `<a class="nav ${view === v ? "on" : ""}" href="${href ?? `/admin?view=${encodeURIComponent(v)}`}"><span class="d">${icon}</span>${esc(label)}</a>`;
  const appLinks = apps.map((a) => item(a.slug, a.name, ICON.app)).join("");
  const labels: Record<string, string> = {
    overview: "Übersicht", inbox: "Inbox", bookings: "Bookings", cal: "Cal Admin", revenue: "Einnahmen", payouts: "Auszahlungen", analytics: "Analytics", outreach: "Outreach",
  };
  const here =
    labels[view] ?? apps.find((a) => a.slug === view)?.name ?? "Übersicht";
  return `<div class="layout">
    <aside class="side">
      <a class="brand" href="/admin?view=overview" aria-label="Klar Control Home">
        <span class="brand-mark"><img src="/logo/klar-symbol.png" alt="" width="34" height="34"/></span>
        <span class="brand-text"><span class="brand-name">Klar</span><span class="brand-sub">Control</span></span>
      </a>
      <div class="navsec">Studio</div>
      ${item("overview", "Übersicht", ICON.overview)}
      ${item("inbox", "Inbox", ICON.inbox)}
      ${item("bookings", "Bookings", ICON.calendar)}
      ${item("cal", "Cal Admin", ICON.calendar)}
      ${item("analytics", "Analytics", ICON.analytics, "/admin/analytics")}
      <div class="navsec">Affiliate</div>
      ${item("revenue", "Einnahmen", ICON.revenue)}
      ${item("payouts", "Auszahlungen", ICON.payouts)}
      ${appLinks || `<span class="nav muted"><span class="d">${ICON.app}</span>keine Apps</span>`}
      <div class="navsec">Extern</div>
      ${item("outreach", "Outreach", ICON.outreach)}
      <a class="nav" href="https://cal.getklar.org" target="_blank" rel="noopener"><span class="d">${ICON.calendar}</span>Cal in neuem Tab <span style="margin-left:auto;font-size:10px;opacity:.6">↗</span></a>
      <div class="spacer"></div>
      ${item("settings", "Einstellungen", ICON.lock, "/admin/settings")}
      <a class="nav logout" href="/admin/logout"><span class="d">${ICON.logout}</span>Logout</a>
    </aside>
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

// Server-rendered SVG grouped bar chart. series: [{label, gross, payout}] in cents.
// Colours reference --chart-* CSS vars so the chart adapts to light/dark theme.
function barChart(series: { label: string; gross: number; payout: number }[]): string {
  if (series.length === 0)
    return `<div class="chart muted" style="font-size:13px">Noch keine Einnahmen-Daten.</div>`;
  const W = 1000, H = 260, padL = 60, padB = 34, padT = 14, padR = 14;
  const cw = (W - padL - padR) / series.length;
  const max = Math.max(1, ...series.map((d) => Math.max(d.gross, d.payout)));
  const niceMax = Math.ceil(max / 100) * 100;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / niceMax);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = niceMax * f, yy = y(val);
    return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${padL - 8}" y="${yy + 3}" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="9" fill="var(--fg-3)">${(val / 100).toFixed(0)}</text>`;
  }).join("");
  const bars = series.map((d, i) => {
    const x0 = padL + i * cw;
    const bw = Math.max(6, cw * 0.30);
    const gx = x0 + cw / 2 - bw - 3, px = x0 + cw / 2 + 3;
    const gy = y(Math.max(0, d.gross)), py = y(Math.max(0, d.payout));
    const base = y(0);
    return `<rect x="${gx}" y="${gy}" width="${bw}" height="${Math.max(0, base - gy)}" rx="2" fill="var(--chart-1)"/>
      <rect x="${px}" y="${py}" width="${bw}" height="${Math.max(0, base - py)}" rx="2" fill="var(--chart-2)"/>
      <text x="${x0 + cw / 2}" y="${H - padB + 16}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="9" fill="var(--fg-3)">${esc(d.label)}</text>`;
  }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Einnahmen pro Monat">
    ${gridLines}<line x1="${padL}" y1="${y(0)}" x2="${W - padR}" y2="${y(0)}" stroke="var(--line-strong)" stroke-width="1"/>${bars}</svg>
    <div class="legend"><span><i style="background:var(--chart-1)"></i>Affiliate-Umsatz</span><span><i style="background:var(--chart-2)"></i>Auszahlung an Affiliates</span><span>${esc(REPORTING_CURRENCY)} pro Monat</span></div></div>`;
}

// Tab strip with all six Klar apps. Apps that are wired up in KLAR_ADMIN_APPS
// link to /admin?view=<slug>; the rest are dimmed but still visible so the
// studio always sees the full portfolio at a glance.
function appTabStrip(connectedSlugs: Set<string>): string {
  return `<div class="app-tabs">${KLAR_APPS.map((a: KlarAppMeta) => {
    const connected = connectedSlugs.has(a.slug);
    const badge = a.status === "LIVE"
      ? `<span class="badge live">Live</span>`
      : `<span class="badge">${esc(a.status)}</span>`;
    const inner = `${badge}
      <span class="app-icon"><img src="${esc(a.icon)}" alt="${esc(a.name)}" loading="lazy"/></span>
      <span class="app-name">${esc(a.name)}</span>
      <span class="app-meta">${connected ? "Affiliate" : "nicht verdrahtet"}</span>`;
    return connected
      ? `<a class="app-tab" href="/admin?view=${esc(a.slug)}">${inner}</a>`
      : `<span class="app-tab dim" title="Affiliate-Schema noch nicht verdrahtet">${inner}</span>`;
  }).join("")}</div>`;
}

async function overview(apps: AdminApp[]): Promise<string> {
  const connected = new Set(apps.map((a) => a.slug));
  const tabs = appTabStrip(connected);

  if (apps.length === 0) {
    return `<h1>Übersicht</h1><p class="sub">Alle Klar-Apps auf einen Blick. Klick eine verdrahtete App fürs Affiliate-Detail; die anderen tauchen auf, sobald sie ein Schema in <code>KLAR_ADMIN_APPS</code> bekommen.</p>${tabs}`;
  }

  const rows = await Promise.all(apps.map(async (app) => {
    const [inf, claim, outreach] = await Promise.all([
      sbGet(app, "influencers?select=status"),
      sbGet(app, "influencer_claimable?select=claimable_eur_cents,unnormalized_events"),
      listOutreachTargets({ platform: "all", status: "all", app: app.slug, limit: 500 }),
    ]);
    const onboarded = inf.length > 0 || claim.length > 0 || outreach.length > 0;
    const active = inf.filter((i: any) => i.status === "active").length;
    const open = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);
    const fx = claim.reduce((s: number, c: any) => s + Number(c.unnormalized_events ?? 0), 0);
    // S32-eve: per-app outreach bucket counters so the admin sees at a glance
    // how many influencers are mid-funnel for each app from the overview page.
    let angefragt = 0, reply = 0, angenommen = 0;
    for (const t of outreach) {
      if (t.status === "converted") angenommen++;
      else if (t.status === "replied") reply++;
      else if (t.mail_status === "mail1_sent" || t.mail_status === "mail2_sent" || t.status === "dm_sent") angefragt++;
    }
    return { app, onboarded, total: inf.length, active, open, fx, angefragt, reply, angenommen };
  }));
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const totalAff = rows.reduce((s, r) => s + r.total, 0);
  const totalAngefragt = rows.reduce((s, r) => s + r.angefragt, 0);
  const totalReply = rows.reduce((s, r) => s + r.reply, 0);
  const cards = `<div class="cards">
    <div class="card"><div class="k">Apps verdrahtet</div><div class="v">${rows.length}/${KLAR_APPS.length}</div><div class="s">${rows.filter(r=>r.onboarded).length} mit Daten</div></div>
    <div class="card"><div class="k">Affiliates gesamt</div><div class="v">${totalAff}</div></div>
    <div class="card"><div class="k">Im Outreach</div><div class="v">${totalAngefragt}</div><div class="s">${totalReply} mit Reply</div></div>
    <div class="card"><div class="k">Offen gesamt</div><div class="v">${eur(totalOpen)}</div><div class="s">netto, gereift</div></div>
  </div>`;
  const pill = (n: number, bg: string, fg: string): string => n === 0
    ? `<span class="muted">0</span>`
    : `<span class="pill" style="background:${bg};color:${fg};border-color:${fg}22;font-weight:600">${n}</span>`;
  const tbl = `<table><thead><tr><th>App</th><th class="r">Affiliates</th><th class="r">Aktiv</th><th class="c">✉ Angefragt</th><th class="c">↩ Reply</th><th class="c">✓ Angenommen</th><th class="r">Offen (${esc(REPORTING_CURRENCY)})</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr>
      <td><a class="applink" href="/admin?view=${esc(r.app.slug)}">${esc(r.app.name)}</a> ${r.onboarded ? "" : `<span class="pill">nicht ausgerollt</span>`}</td>
      <td class="r">${r.total}</td><td class="r">${r.active}</td>
      <td class="c">${pill(r.angefragt, "#dbeafe", "#1e40af")}</td>
      <td class="c">${pill(r.reply, "#fef9c3", "#854d0e")}</td>
      <td class="c">${pill(r.angenommen, "#dcfce7", "#166534")}</td>
      <td class="r">${eur(r.open)}</td>
      <td class="r"><a class="pill" href="/admin?view=${esc(r.app.slug)}">öffnen</a></td>
    </tr>`).join("")}
  </tbody></table>`;
  return `<h1>Übersicht</h1><p class="sub">Alle Klar-Apps auf einen Blick. Wähl eine verdrahtete App fürs Affiliate-Detail.</p>${tabs}<h2>Affiliate-Stand · Outreach-Funnel</h2>${cards}${tbl}`;
}

async function revenueView(apps: AdminApp[]): Promise<string> {
  if (apps.length === 0)
    return `<h1>Einnahmen</h1><p class="sub">Noch keine Apps konfiguriert, darum gibt es hier nichts zu zeigen.</p>`;
  const monthly = new Map<string, { gross: number; payout: number }>();
  let totalGross = 0, totalPayout = 0, totalOpen = 0, totalAff = 0;

  const perApp = await Promise.all(apps.map(async (app) => {
    const [inf, claim, events] = await Promise.all([
      sbGet(app, "influencers?select=status"),
      sbGet(app, "influencer_claimable?select=claimable_eur_cents"),
      sbGet(app, "referral_revenue_events?select=event_at,gross_revenue_cents,share_cents_eur&order=event_at&limit=4000"),
    ]);
    let gross = 0, payout = 0;
    for (const e of events) {
      const g = Number(e.gross_revenue_cents ?? 0);
      const p = Number(e.share_cents_eur ?? 0);
      gross += g; payout += p;
      const mkey = String(e.event_at ?? "").slice(0, 7);
      if (mkey) {
        const m = monthly.get(mkey) ?? { gross: 0, payout: 0 };
        m.gross += g; m.payout += p;
        monthly.set(mkey, m);
      }
    }
    const open = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);
    totalGross += gross; totalPayout += payout; totalOpen += open; totalAff += inf.length;
    return { app, affiliates: inf.length, gross, payout, open };
  }));

  const series = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([k, v]) => {
      const [yy, mm] = k.split("-");
      return { label: `${mm}/${yy.slice(2)}`, gross: v.gross, payout: v.payout };
    });

  const cards = `<div class="cards">
    <div class="card"><div class="k">Affiliate-Umsatz gesamt</div><div class="v">${eur(totalGross)}</div><div class="s">von geworbenen Usern</div></div>
    <div class="card"><div class="k">Auszahlung an Affiliates</div><div class="v">${eur(totalPayout)}</div><div class="s">verbucht (50% Anteil)</div></div>
    <div class="card"><div class="k">Davon offen</div><div class="v">${eur(totalOpen)}</div><div class="s">noch nicht ausgezahlt</div></div>
    <div class="card"><div class="k">Affiliates gesamt</div><div class="v">${totalAff}</div></div>
  </div>`;

  const tbl = `<table><thead><tr><th>App</th><th class="r">Affiliates</th><th class="r">Affiliate-Umsatz</th><th class="r">Auszahlung verbucht</th><th class="r">Offen</th></tr></thead><tbody>
    ${perApp.map((r) => `<tr>
      <td><a class="applink" href="/admin?view=${esc(r.app.slug)}">${esc(r.app.name)}</a></td>
      <td class="r">${r.affiliates}</td>
      <td class="r">${eur(r.gross)}</td>
      <td class="r">${eur(r.payout)}</td>
      <td class="r">${eur(r.open)}</td>
    </tr>`).join("")}
  </tbody></table>`;

  return `<h1>Einnahmen</h1><p class="sub">Affiliate-attribuierter Umsatz pro App und Monat. Nicht der gesamte App-Umsatz, der bräuchte RevenueCat- und Store-Daten als separate Integration.</p>
    ${cards}<h2>Pro Monat</h2>${barChart(series)}<h2>Pro App</h2>${tbl}`;
}

async function appView(app: AdminApp): Promise<string> {
  const [inf, claim, batches, outreachTargets] = await Promise.all([
    listInfluencers(app),
    sbGet(app, "influencer_claimable?select=handle,status,payout_method,matured_share_eur_cents,paid_eur_cents,claimable_eur_cents,unnormalized_events&order=claimable_eur_cents.desc"),
    sbGet(app, "influencer_payout_batches?select=id,period_start,period_end,status,item_count,total_amount_cents&order=created_at.desc&limit=8"),
    listOutreachTargets({ platform: "all", status: "all", app: app.slug, limit: 200 }),
  ]);
  if (inf.length === 0 && claim.length === 0 && batches.length === 0 && outreachTargets.length === 0)
    return `<h1>${esc(app.name)}</h1>
      <p class="sub">Noch keine Affiliates aktiv für ${esc(app.name)}. Schema ist ausgerollt und bereit.</p>
      ${createAffiliateForm(app)}
      <div class="card" style="margin-top:18px;padding:20px;max-width:560px">
        <div class="k" style="margin-bottom:8px">So kommt der erste Affiliate rein</div>
        <ol class="muted" style="margin:0 0 14px 18px;padding:0;line-height:1.7;font-size:13px">
          <li>Influencer füllt das Formular auf <a class="applink" href="https://getklar.org/#affiliate" target="_blank" rel="noopener">getklar.org/#affiliate</a> aus.</li>
          <li>Anfrage landet in der <a class="applink" href="/admin?view=inbox&amp;type=affiliate">Inbox</a> mit Approve-Form.</li>
          <li>App wählen, Handle &amp; Share-% setzen, Onboarding-Link generieren und versenden.</li>
          <li>Sobald der Influencer das Setup abschließt, taucht er hier auf.</li>
        </ol>
        <a class="btn" href="/admin?view=inbox&amp;type=affiliate" style="display:inline-block">Zur Inbox →</a>
        <a class="btn ghost" href="/admin?view=outreach" style="display:inline-block;margin-left:8px">Outreach-Tracker →</a>
      </div>`;
  const active = inf.filter((i) => i.status === "active").length;
  const suspended = inf.filter((i) => i.status === "suspended" || i.status === "banned").length;
  const pending = inf.filter((i) => i.status === "pending").length;
  const open = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);
  const ids = batches.map((b: any) => b.id);
  const items = ids.length
    ? await sbGet(app, `influencer_payout_items?batch_id=in.(${ids.join(",")})&select=batch_id,influencer_handle,amount_cents,payout_method,status,provider_ref,provider_error&order=created_at.desc`)
    : [];
  const cards = `<div class="cards">
    <div class="card"><div class="k">Affiliates</div><div class="v">${inf.length}</div><div class="s">${active} aktiv${suspended ? ` · ${suspended} suspendiert` : ""}${pending ? ` · ${pending} pending` : ""}</div></div>
    <div class="card"><div class="k">Offen</div><div class="v">${eur(open)}</div><div class="s">gereift, netto Refunds</div></div>
    <div class="card"><div class="k">Batches</div><div class="v">${batches.length}</div></div>
  </div>`;
  const claimRows = claim.length
    ? claim.map((c: any) => `<tr><td>${esc(c.handle)}</td><td><span class="pill ${c.status==="active"?"live":""}">${esc(c.status)}</span></td><td>${esc(c.payout_method ?? "-")}</td>
        <td class="r">${eur(c.matured_share_eur_cents)}</td><td class="r">${eur(c.paid_eur_cents)}</td>
        <td class="r">${eur(c.claimable_eur_cents)}</td>
        <td class="c">${Number(c.unnormalized_events)>0?`<span class="warn">${esc(c.unnormalized_events)} FX</span>`:"ok"}</td></tr>`).join("")
    : `<tr><td colspan="7" class="muted">keine gereiften Conversions</td></tr>`;
  const batchHtml = batches.map((b: any) => {
    const bi = items.filter((i: any) => i.batch_id === b.id);
    const rows = bi.map((i: any) => `<tr><td>${esc(i.influencer_handle)}</td><td class="r">${eur(i.amount_cents)}</td><td>${esc(i.payout_method)}</td><td>${esc(i.status)}</td><td class="muted" style="font-size:11px">${esc(i.provider_ref ?? i.provider_error ?? "")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">keine Items</td></tr>`;
    const can = b.status === "draft" || b.status === "awaiting_release";
    return `<div class="batch"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:13px"><strong>${esc(b.period_start)} – ${esc(b.period_end)}</strong><span class="muted">${esc(b.status)} · ${esc(b.item_count)} · ${eur(b.total_amount_cents)}</span></div>
      ${can ? `<form method="POST" action="/admin/dispatch" style="margin:11px 0"><input type="hidden" name="app" value="${esc(app.slug)}"/><input type="hidden" name="batch_id" value="${esc(b.id)}"/><button class="btn" type="submit">Via Wise vorbereiten</button></form>` : ""}
      <table style="margin-top:8px"><thead><tr><th>Handle</th><th class="r">Betrag</th><th>Methode</th><th>Status</th><th>Ref</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");
  // Influencer-Liste mit Suspend/Activate/Hard-Delete-Aktionen
  const infStatusPill = (st: string): string => {
    const map: Record<string, { bg: string; fg: string }> = {
      active:    { bg: "#dcfce7", fg: "#166534" },
      pending:   { bg: "#fef3c7", fg: "#92400e" },
      suspended: { bg: "#fee2e2", fg: "#991b1b" },
      banned:    { bg: "#fee2e2", fg: "#991b1b" },
      paused:    { bg: "#e5e5e5", fg: "#525252" },
      terminated:{ bg: "#e5e5e5", fg: "#525252" },
    };
    const c = map[st] ?? { bg: "#e0e7ff", fg: "#3730a3" };
    return `<span class="pill" style="background:${c.bg};color:${c.fg};border-color:${c.fg}22;font-weight:600">${esc(st)}</span>`;
  };
  const infActions = (i: InfluencerRow): string => {
    const slug = esc(app.slug);
    const handle = esc(i.handle);
    // active → suspend / banned
    // suspended/banned → reactivate
    const buttons: string[] = [];
    if (i.status === "active" || i.status === "pending") {
      buttons.push(`<form method="POST" action="/admin/influencer/suspend" style="display:inline" data-klar-confirm="Bestehende Payouts laufen aus, neue Events kriegen counts_for_payout=false." data-klar-confirm-title="@${handle} suspendieren?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Suspendieren">
        <input type="hidden" name="app" value="${slug}"/>
        <input type="hidden" name="handle" value="${handle}"/>
        <input type="hidden" name="status" value="suspended"/>
        <button type="submit" class="btn ghost" style="padding:3px 9px;font-size:11px;color:var(--danger)">Suspend</button>
      </form>`);
      buttons.push(`<form method="POST" action="/admin/influencer/suspend" style="display:inline" data-klar-confirm="Wie Suspend, aber als bleibend markiert. Affiliate kann nicht reaktiviert werden." data-klar-confirm-title="@${handle} permanent bannen?" data-klar-confirm-variant="danger" data-klar-confirm-ok="Permanent bannen">
        <input type="hidden" name="app" value="${slug}"/>
        <input type="hidden" name="handle" value="${handle}"/>
        <input type="hidden" name="status" value="banned"/>
        <button type="submit" class="btn ghost" style="padding:3px 9px;font-size:11px;color:var(--danger)">Ban</button>
      </form>`);
    }
    if (i.status === "suspended" || i.status === "banned" || i.status === "paused") {
      buttons.push(`<form method="POST" action="/admin/influencer/suspend" style="display:inline">
        <input type="hidden" name="app" value="${slug}"/>
        <input type="hidden" name="handle" value="${handle}"/>
        <input type="hidden" name="status" value="active"/>
        <button type="submit" class="btn ghost" style="padding:3px 9px;font-size:11px;color:var(--success)">Reaktivieren</button>
      </form>`);
    }
    // Rotate (neuen Onboarding-Link erzeugen) + Hard delete nur bei pending.
    if (i.status === "pending") {
      buttons.push(`<form method="POST" action="/admin/affiliate-rotate" style="display:inline" data-klar-confirm="Erzeugt einen neuen Onboarding-Link (7 Tage gültig). Der alte Link wird sofort ungültig." data-klar-confirm-title="@${handle} Link rotieren?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Rotieren">
        <input type="hidden" name="app" value="${slug}"/>
        <input type="hidden" name="handle" value="${handle}"/>
        <button type="submit" class="btn ghost" style="padding:3px 9px;font-size:11px">Rotate</button>
      </form>`);
      buttons.push(`<form method="POST" action="/admin/influencer/delete" style="display:inline" data-klar-confirm="Geht nur wenn keine referrals/events existieren. Bei Active oder Suspended bitte ban statt delete." data-klar-confirm-title="@${handle} hart löschen?" data-klar-confirm-variant="danger" data-klar-confirm-ok="Endgültig löschen">
        <input type="hidden" name="app" value="${slug}"/>
        <input type="hidden" name="handle" value="${handle}"/>
        <button type="submit" class="btn ghost" style="padding:3px 9px;font-size:11px;color:var(--danger)" title="Hard delete">✕</button>
      </form>`);
    }
    return buttons.join(" ");
  };
  const infRows = inf.length === 0
    ? `<tr><td colspan="6" class="muted">noch keine Affiliates onboarded für ${esc(app.name)}</td></tr>`
    : inf.map((i) => {
        const sharePct = i.share_pct ?? i.share_percent ?? null;
        const setupExpired = i.setup_token && i.setup_token_expires_at
          ? new Date(i.setup_token_expires_at).getTime() < Date.now()
          : false;
        const setupBadge = i.status === "pending" && i.setup_token
          ? setupExpired
            ? `<span class="pill" style="background:#fee2e2;color:#991b1b;font-size:9px">Token expired</span>`
            : `<span class="pill" style="background:#dbeafe;color:#1e40af;font-size:9px">invited</span>`
          : "";
        const onboardingUrl = i.status === "pending" && i.setup_token && !setupExpired
          ? setupLandingUrl(app.slug, i.setup_token)
          : "";
        const trackingUrl = trackingLinkFor(app, i);
        const copyBtn = (label: string, url: string): string =>
          `<button type="button" class="btn ghost" title="${esc(url)}" style="padding:2px 8px;font-size:10px" onclick="navigator.clipboard.writeText('${url}').then(()=>this.textContent='&#10003; ${label}').catch(()=>this.textContent='copy failed')">Copy ${label}</button>`;
        const links = onboardingUrl || trackingUrl
          ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${onboardingUrl ? copyBtn("Onboarding", onboardingUrl) : ""}${trackingUrl ? copyBtn("Tracking", trackingUrl) : ""}</div>`
          : "";
        return `<tr>
          <td>${esc(i.handle)}<div class="muted" style="font-size:11px">${esc(i.display_name ?? "")}${i.promo_code ? ` · code <strong>${esc(i.promo_code)}</strong>` : ""}</div>${links}</td>
          <td>${infStatusPill(i.status)} ${setupBadge}</td>
          <td>${esc(i.contact_email ?? "—")}</td>
          <td>${esc(i.payout_method ?? "—")}<div class="muted" style="font-size:11px">${esc(i.country ?? "")}</div></td>
          <td class="r">${sharePct !== null ? `${sharePct}%` : "—"}${i.share_months ? `<div class="muted" style="font-size:11px">${i.share_months}mo</div>` : ""}</td>
          <td class="r" style="white-space:nowrap">${infActions(i)}</td>
        </tr>`;
      }).join("");

  // ----- Outreach-Pipeline-Block pro App (Angefragt/Reply/Angenommen) -----
  // Filtert klar_outreach_targets auf die targets die diese App als
  // for_apps Tag tragen, gruppiert nach Status-Bucket.
  const appBucket = { angefragt: [] as OutreachTarget[], reply: [] as OutreachTarget[], angenommen: [] as OutreachTarget[] };
  for (const t of outreachTargets) {
    if (t.status === "converted") appBucket.angenommen.push(t);
    else if (t.status === "replied") appBucket.reply.push(t);
    else if (t.mail_status === "mail1_sent" || t.mail_status === "mail2_sent" || t.status === "dm_sent") appBucket.angefragt.push(t);
  }
  const sortNewestFirst = (a: OutreachTarget, b: OutreachTarget) => {
    const ax = new Date(a.last_message_at || a.mail1_sent_at || a.updated_at).getTime();
    const bx = new Date(b.last_message_at || b.mail1_sent_at || b.updated_at).getTime();
    return bx - ax;
  };
  appBucket.angefragt.sort(sortNewestFirst);
  appBucket.reply.sort(sortNewestFirst);
  appBucket.angenommen.sort(sortNewestFirst);
  const renderAppOutreachRow = (t: OutreachTarget): string => {
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
        <div style="display:flex;gap:6px;align-items:center">${profileLink}<span class="pill" style="font-size:8px;padding:1px 5px">${platIcon}</span>${fLabel ? `<span class="muted" style="font-size:10px;font-family:var(--font-mono)">${esc(fLabel)}</span>` : ""}</div>
        ${t.contact_email ? `<div class="muted" style="font-size:10px;margin-top:1px;font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.contact_email)}</div>` : ""}
        ${t.last_message ? `<div class="muted" style="font-size:10px;margin-top:2px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.last_message)}">↩ ${esc(t.last_message.slice(0, 90))}</div>` : ""}
      </div>
      <div class="muted" style="font-size:10px;white-space:nowrap;text-align:right">${esc(sentRel)}</div>
    </div>`;
  };
  const renderAppBucketCol = (label: string, items: OutreachTarget[], emoji: string): string => `
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;min-height:120px">
      <div style="padding:10px 12px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:baseline">
        <span class="k">${emoji} ${esc(label)}</span>
        <span style="font-family:var(--font-display);font-weight:800;font-size:18px;color:var(--fg)">${items.length}</span>
      </div>
      ${items.length === 0
        ? `<div class="muted" style="padding:12px;font-style:italic;font-size:11px">keine Einträge</div>`
        : items.slice(0, 10).map(renderAppOutreachRow).join("") +
          (items.length > 10 ? `<div class="muted" style="padding:8px 12px;font-size:11px">+ ${items.length - 10} weitere</div>` : "")}
    </div>`;
  const outreachBlock = outreachTargets.length === 0
    ? ""
    : `<h2>Outreach-Pipeline <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${outreachTargets.length} Targets · ${appBucket.angefragt.length} angefragt · ${appBucket.reply.length} reply · ${appBucket.angenommen.length} angenommen</span></h2>
      <p class="sub muted" style="margin:0 0 14px;font-size:12px">Influencer aus der Wave-Pipeline für ${esc(app.name)}. Status-Übergänge: Mail-1 raus → Reply via Gmail-Tracker → Onboarding-Setup durch.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:24px">
        ${renderAppBucketCol("Angefragt", appBucket.angefragt, "✉")}
        ${renderAppBucketCol("Reply", appBucket.reply, "↩")}
        ${renderAppBucketCol("Angenommen", appBucket.angenommen, "✓")}
      </div>`;

  return `<h1>${esc(app.name)}</h1><p class="sub">Affiliate-Salden, Auszahlungen und Affiliates für ${esc(app.name)}.</p>${cards}
    <form method="POST" action="/admin/reconcile" style="margin:0 0 18px"><input type="hidden" name="app" value="${esc(app.slug)}"/><button class="btn ghost" type="submit">Status aktualisieren · Wise nach DB</button></form>
    ${createAffiliateForm(app)}
    <h2>Affiliates <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${inf.length} Einträge</span></h2>
    <table>
      <thead><tr><th>Handle</th><th>Status</th><th>Email</th><th>Auszahlung</th><th class="r">Share</th><th class="r">Aktionen</th></tr></thead>
      <tbody>${infRows}</tbody>
    </table>
    ${outreachBlock}
    <h2>Salden + Conversions</h2>
    <table><thead><tr><th>Handle</th><th>Status</th><th>Methode</th><th class="r">Gereift</th><th class="r">Bezahlt</th><th class="r">Offen</th><th class="c">FX</th></tr></thead><tbody>${claimRows}</tbody></table>
    <h2>Batches</h2>${batchHtml || `<p class="muted">noch keine Batches (pg_cron baut am 1. des Monats)</p>`}`;
}

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
const STATUS_COLOR: Record<OutreachStatus, { bg: string; fg: string }> = {
  queued:    { bg: "#e0e7ff", fg: "#3730a3" },
  dm_sent:   { bg: "#fef3c7", fg: "#92400e" },
  replied:   { bg: "#fce7f3", fg: "#9d174d" },
  declined:  { bg: "#fee2e2", fg: "#991b1b" },
  converted: { bg: "#dcfce7", fg: "#166534" },
  dead:      { bg: "#e5e5e5", fg: "#525252" },
};
function statusPill(s: OutreachStatus): string {
  const c = STATUS_COLOR[s];
  const l = STATUS_LABEL[s];
  return `<span class="pill" style="background:${c.bg};color:${c.fg};border-color:${c.fg}22;font-weight:600">${esc(l)}</span>`;
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
function fmtRelative(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "heute";
  if (days < 2) return "gestern";
  if (days < 30) return `vor ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months}mo`;
  return `vor ${Math.floor(months / 12)}y`;
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
          <summary style="cursor:pointer;padding:4px 9px;font-size:11px;font-family:var(--font-body);color:var(--fg-3);border:1px solid var(--line);border-radius:6px;user-select:none;list-style:none">✕ Ablehnen</summary>
          <form method="POST" action="/admin/outreach/decline" style="display:flex;gap:6px;align-items:center;margin-top:6px;padding:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;flex-wrap:wrap" data-klar-confirm="Status wird auf 'declined' gesetzt. Bei aktivierter Suppression wird @${esc(t.handle)} in zukünftigen Wellen übersprungen." data-klar-confirm-title="@${esc(t.handle)} ablehnen?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Ablehnen">
            <input type="hidden" name="id" value="${esc(t.id)}"/>
            <input type="text" name="reason" maxlength="280" placeholder="Grund (optional, intern)" style="padding:5px 8px;font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:5px;color:var(--fg);min-width:200px"/>
            <label style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--fg-2);cursor:pointer;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em" title="Influencer auf Suppression-Liste setzen">
              <input type="checkbox" name="suppress" value="1" checked style="cursor:pointer"/>
              Suppress
            </label>
            <button type="submit" class="btn" style="padding:5px 11px;font-size:11px;background:#475569;border-color:#475569">Ablehnen</button>
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
    <p class="muted" style="margin:0 0 22px;font-size:13px">Apify scraped die gewählten Plattformen, Apps und Größen-Buckets, schickt Mail-1 via Brevo, trackt alles in der DB. Templates pro App lädst du unten oder unter <a class="applink" href="/admin?view=templates">Templates</a>.</p>
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
    const palette: Record<typeof p.tone, { bg: string; fg: string }> = {
      wait:   { bg: "#fef9c3", fg: "#854d0e" },
      active: { bg: "#dbeafe", fg: "#1e40af" },
      done:   { bg: "#dcfce7", fg: "#166534" },
      warn:   { bg: "#fed7aa", fg: "#9a3412" },
    };
    const c = palette[p.tone];
    return `<span class="pill" style="background:${c.bg};color:${c.fg};border-color:${c.fg}22;font-weight:500;font-size:9px;margin-top:3px;display:inline-block">${esc(p.label)}</span>`;
  };

  const runStatusPill = (r: OutreachRun): string => {
    const s = r.status;
    if (isStale(r)) {
      return `<span class="pill" style="background:#fed7aa;color:#9a3412;border-color:#fb923c33;font-weight:600;font-size:9px">⚠ stale running</span>`;
    }
    const m: Record<string, { bg: string; fg: string; label: string }> = {
      queued:    { bg: "#fef9c3", fg: "#854d0e", label: "queued" },
      running:   { bg: "#dbeafe", fg: "#1e40af", label: "running" },
      done:      { bg: "#dcfce7", fg: "#166534", label: "✓ done" },
      failed:    { bg: "#fee2e2", fg: "#991b1b", label: "✕ failed" },
      cancelled: { bg: "#e5e5e5", fg: "#525252", label: "cancelled" },
    };
    const c = m[s] ?? { bg: "#e0e7ff", fg: "#3730a3", label: s };
    return `<span class="pill" style="background:${c.bg};color:${c.fg};border-color:${c.fg}22;font-weight:600;font-size:9px">${esc(c.label)}</span>`;
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
    ? `<div style="font-size:11px;color:var(--fg-2);margin:8px 0 4px;padding:6px 10px;background:#dbeafe;border-radius:6px;border:1px solid #93c5fd33;display:inline-block">
        Eine Welle ist running. Auto-Refresh aktivieren um Progress live zu sehen:
        <a class="applink" href="?view=outreach&amp;ar=1" style="font-weight:600;margin-left:4px">15s ⟲ ein</a>
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
  const apifyAccColor = apifyAccPct >= 90 ? "#dc2626" : apifyAccPct >= 70 ? "#d97706" : "#16a34a";
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
    const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#d97706" : "#16a34a";
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
  const brevoColor = brevoPct >= 90 ? "#dc2626" : brevoPct >= 70 ? "#d97706" : "#16a34a";
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
  const canTranslate = isTranslateConfigured();

  // Template-Lookup für den Client (lang -> id -> {subject, body}). `<` wird
  // escaped, damit der JSON-Blob den <script>-Kontext nicht sprengen kann.
  const replyTemplateMap: Record<string, Record<string, { subject: string; body: string }>> = {};
  for (const lng of Object.keys(REPLY_TEMPLATES) as ReplyLang[]) {
    replyTemplateMap[lng] = {};
    for (const tpl of REPLY_TEMPLATES[lng]) {
      replyTemplateMap[lng][tpl.id] = { subject: tpl.subject, body: tpl.body };
    }
  }
  const replyTemplateJson = JSON.stringify(replyTemplateMap).replace(/</g, "\\u003c");

  // Vorlagen-Dropdown: optgroup pro Sprache, value = "lang:id". Default
  // selektiert = Interesse-Vorlage in der Sprache des Targets.
  const templateSelectOptions = (defLang: ReplyLang): string =>
    (Object.keys(REPLY_TEMPLATES) as ReplyLang[])
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

  const LANG_OK = /^(de|en|fr|es|it|nl|pt|pl)$/;
  const replyCard = (t: OutreachTarget): string => {
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
    const whenRel = t.last_message_at
      ? fmtRelative(t.last_message_at)
      : t.replied_at
        ? fmtRelative(t.replied_at)
        : fmtRelative(t.updated_at);

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

    // Eingehende Reply.
    const incoming = `<div style="background:var(--surface-2);border-left:3px solid var(--line-strong);border-radius:6px;padding:10px 12px;margin:10px 0">
      ${t.reply_subject ? `<div style="font-weight:600;font-size:12px;margin-bottom:4px">${esc(t.reply_subject)}</div>` : ""}
      ${
        t.last_message
          ? `<div class="reply-incoming" data-raw="${esc(rawForTrans)}" data-src-lang="${esc(tplLang)}" style="white-space:pre-wrap;font-size:13px;color:var(--fg);font-family:var(--font-body)">${esc(t.last_message)}</div>`
          : `<div class="muted" style="font-size:12px;font-style:italic">Kein Reply-Text erfasst (Status wurde manuell auf "Antwort" gesetzt).</div>`
      }
      ${
        t.last_message && canTranslate
          ? `<div style="margin-top:8px"><button type="button" class="btn ghost" style="padding:3px 9px;font-size:11px" onclick="klarTranslate(this)">DE übersetzen</button><div class="reply-trans muted" style="margin-top:6px;font-size:12px;white-space:pre-wrap"></div></div>`
          : t.last_message
            ? `<div class="muted" style="margin-top:6px;font-size:10px;font-style:italic">Übersetzen aktiv sobald <code>DEEPL_API_KEY</code> in Vercel gesetzt ist.</div>`
            : ""
      }
    </div>`;

    // Antwort-Composer.
    const composer = `<details open style="margin-top:4px">
      <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--fg-2);user-select:none">Antworten (Mail)</summary>
      <form method="POST" action="/admin/outreach/reply" style="margin-top:10px;display:flex;flex-direction:column;gap:8px" data-klar-confirm="Mail geht sofort an ${esc(toEmail)}. Status bleibt auf 'Antwort', der Influencer wird dadurch NICHT angenommen." data-klar-confirm-title="Antwort an @${esc(t.handle)} senden?" data-klar-confirm-ok="Senden">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <input type="hidden" name="to" value="${esc(toEmail)}"/>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <label style="font-size:11px;color:var(--fg-3);display:inline-flex;align-items:center;gap:4px">Vorlage
            <select onchange="klarReplyFill(this)" style="padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;background:var(--bg);color:var(--fg);font-size:12px">
              ${templateSelectOptions(tplLang)}
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
        <button type="submit" class="btn" style="padding:6px 14px;font-size:12px;background:#16a34a;border-color:#16a34a">✓ Als Affiliate annehmen</button>
      </form>
      <form method="POST" action="/admin/outreach/decline" style="display:inline" data-klar-confirm="Status → declined. @${esc(t.handle)} wird in zukünftigen Wellen übersprungen (Suppression)." data-klar-confirm-title="@${esc(t.handle)} ablehnen?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Ablehnen">
        <input type="hidden" name="id" value="${esc(t.id)}"/>
        <input type="hidden" name="suppress" value="1"/>
        <button type="submit" class="btn ghost" style="padding:6px 11px;font-size:12px">✕ Ablehnen</button>
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

  const repliesInboxJs = `
window.KLAR_REPLY_TEMPLATES = ${replyTemplateJson};
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

  const repliesInbox =
    replyTargets.length === 0
      ? `<h2 style="margin-top:8px">Eingegangene Antworten</h2>
        <p class="sub muted" style="margin:0 0 8px">Keine offenen Antworten. Sobald ein Influencer auf eine Welle antwortet, erscheint er hier mit vollem Text, Übersetzung und Antwort-Composer. <strong>Antwort heisst nicht angenommen</strong>: annehmen passiert erst über den grünen Button.</p>`
      : `<h2 style="margin-top:8px">Eingegangene Antworten <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${replyTargets.length} offen · Antwort ≠ angenommen</span></h2>
        <p class="sub muted" style="margin:0 0 14px">Voller Reply-Text, Übersetzung nach DE, Antwort per Vorlage oder frei. Der Onboarding-Link geht erst über "Als Affiliate annehmen" raus.</p>
        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:8px">
          ${replyTargets.map(replyCard).join("")}
        </div>
        <script>${repliesInboxJs}</script>`;

  return `${refreshMeta}<h1>Outreach</h1>
    <p class="sub">Influencer-Outreach-Tracker. <em>Queued → DM gesendet → Antwort → Converted</em>. Auto-Refresh ${autoRefresh ? "alle 15s" : "aus"}, Daten aus Supabase anime-vault.</p>
    ${apifyAccCard}
    ${brevoQuotaCard}
    ${cards}
    ${costCard}
    ${repliesInbox}
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
    const m = s !== "all" ? SOURCE_META[s] : null;
    const styleOn = m ? `background:${m.bg};color:${m.fg};border:1px solid ${m.fg}88` : `background:var(--fg);color:var(--bg);border:1px solid var(--fg)`;
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
        <summary style="cursor:pointer;padding:6px 12px;font-size:11px;font-family:var(--font-mono);font-weight:600;color:var(--fg-3);text-transform:uppercase;letter-spacing:.04em;border:1px solid var(--line);border-radius:6px;user-select:none;list-style:none">✕ Ablehnen</summary>
        <form method="POST" action="/admin/decline" style="display:flex;gap:6px;align-items:center;margin-top:8px;padding:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px" data-klar-confirm="Status wird auf 'abgelehnt' gesetzt. Mit ↺ jederzeit wieder öffnen." data-klar-confirm-title="Anfrage ablehnen?" data-klar-confirm-variant="warn" data-klar-confirm-ok="Ablehnen">
          <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
          <input type="hidden" name="action" value="decline"/>
          <input type="text" name="reason" maxlength="280" placeholder="Grund (optional, intern)" style="padding:5px 8px;font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:5px;color:var(--fg);min-width:220px"/>
          <button type="submit" class="btn" style="padding:5px 11px;font-size:11px;background:#475569;border-color:#475569">Ablehnen</button>
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
          <span class="pill" style="background:${isLive ? "#dcfce7" : "#dbeafe"};color:${isLive ? "#166534" : "#1e40af"};border:1px solid ${isLive ? "#bbf7d0" : "#bfdbfe"};font-weight:600">${isLive ? "✓ active" : "→ invited"} · ${esc(r.approved_app)}</span>
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
    if (r.status === "active") return `<span class="pill" style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0;font-weight:600">✓ active</span>`;
    if (r.status === "invited" || r.status === "approved") return `<span class="pill" style="background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;font-weight:600">→ invited</span>`;
    if (r.status === "new") return `<span class="pill" style="background:#fef9c3;color:#854d0e;border:1px solid #fde047;font-weight:600">• neu</span>`;
    if (r.status === "declined") return `<span class="pill" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;font-weight:600">✕ abgelehnt</span>`;
    return `<span class="pill">${esc(r.status ?? "—")}</span>`;
  };

  // Type-Badge with category-specific tint so affiliate vs. consulting is
  // distinguishable at a glance independent of source/status.
  const typePillFor = (t: string | undefined): string => {
    if (t === "affiliate") return `<span class="pill" style="background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.6px">Affiliate</span>`;
    if (t === "consulting") return `<span class="pill" style="background:#fce7f3;color:#9d174d;border:1px solid #f9a8d4;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.6px">Consulting</span>`;
    return `<span class="pill" style="font-size:10px">${esc(t ?? "—")}</span>`;
  };

  // Initials-Avatar: stable pastel bg via deterministic hash of the email
  // local-part. Used as the visual anchor on each inbox card.
  const avatarFor = (email: string): string => {
    const local = (email || "?").split("@")[0] || "?";
    const letters = local.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || local.slice(0, 2).toUpperCase();
    let h = 0;
    for (const ch of local) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff;
    const hue = Math.abs(h) % 360;
    const bg = `hsl(${hue}, 55%, 88%)`;
    const fg = `hsl(${hue}, 60%, 28%)`;
    return `<div aria-hidden="true" style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;font-size:14px;letter-spacing:0.02em">${esc(letters)}</div>`;
  };

  // Status indicator: subtle dot for "new" (pulsing), checkmark for
  // active, arrow for invited; pushed into the top-right of each card.
  const statusBadgeFor = (r: Inquiry): string => {
    if (r.status === "active") return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#166534;font-family:var(--font-mono);letter-spacing:.04em;text-transform:uppercase">✓ active</span>`;
    if (r.status === "invited" || r.status === "approved") return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#1e40af;font-family:var(--font-mono);letter-spacing:.04em;text-transform:uppercase">→ invited</span>`;
    if (r.status === "new") return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#854d0e;font-family:var(--font-mono);letter-spacing:.04em;text-transform:uppercase"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#eab308;box-shadow:0 0 0 0 #eab308a0;animation:klar-pulse 1.6s infinite"></span>neu</span>`;
    if (r.status === "declined") return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#475569;font-family:var(--font-mono);letter-spacing:.04em;text-transform:uppercase">✕ abgelehnt</span>`;
    return `<span style="font-size:11px;font-family:var(--font-mono);color:var(--fg-3);letter-spacing:.04em;text-transform:uppercase">${esc(r.status ?? "")}</span>`;
  };

  // Subtle inline type-badge: matches Klar's editorial tone (lowercase
  // mono in tinted pill instead of the previous loud uppercase).
  const typeBadgeMini = (t: string | undefined): string => {
    if (t === "affiliate") return `<span style="font-family:var(--font-mono);font-size:10.5px;font-weight:600;color:#5b21b6;background:#ede9fe;padding:3px 9px;border-radius:999px;letter-spacing:.02em">affiliate</span>`;
    if (t === "consulting") return `<span style="font-family:var(--font-mono);font-size:10.5px;font-weight:600;color:#9d174d;background:#fce7f3;padding:3px 9px;border-radius:999px;letter-spacing:.02em">consulting</span>`;
    return `<span style="font-family:var(--font-mono);font-size:10.5px;color:var(--fg-3);padding:3px 9px;border-radius:999px;background:var(--surface-2)">${esc(t ?? "—")}</span>`;
  };

  const renderCard = (r: Inquiry): string => {
    const details = detailPairs(r)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v, isLong]) => `<div style="display:flex;gap:14px;font-size:13px;line-height:1.55;align-items:${isLong ? "flex-start" : "baseline"};padding:6px 0">
        <span style="min-width:88px;flex-shrink:0;font-family:var(--font-mono);font-weight:500;text-transform:uppercase;letter-spacing:.08em;font-size:9.5px;color:var(--fg-4);padding-top:${isLong ? "4px" : "0"}">${esc(k)}</span>
        <span style="color:var(--fg);flex:1;${isLong ? "white-space:pre-wrap;word-wrap:break-word" : ""}">${esc(v!)}</span>
      </div>`)
      .join("");

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
  </style><h1>Inbox</h1><p class="sub">Affiliate- und Consulting-Anfragen, gefiltert nach Typ und Quelle. Affiliate-Karten haben den <em>Approve</em>-Klappbereich für den Onboarding-Link &mdash; bei neuen Anfragen ist er aufgeklappt.</p>
    ${typeTabs}
    ${sourceFilters}
    ${consultingHint}
    ${cards}
    ${body}`;
}

async function bookingsView(): Promise<string> {
  if (!KLAR_INBOX_KEY)
    return `<h1>Bookings</h1><p class="sub muted">Fast fertig, es fehlt nur der Lese-Key. Setze <span class="warn">KLAR_INBOX_SERVICE_KEY</span> im klar-Vercel-Projekt (Wert: anime-vault &rarr; Settings &rarr; API &rarr; <em>service_role</em>). Cal.com-Webhook schreibt schon nach <code>cal_bookings</code>, nur die Anzeige hier braucht den Key.</p>`;

  let rows: CalBooking[] = [];
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/cal_bookings?select=cal_uid,trigger_event,event_type_slug,title,start_time,end_time,attendee_email,attendee_name,location,status,created_at&order=start_time.desc&limit=200`,
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
      return `<h1>Bookings</h1><p class="sub muted">Bookings konnten nicht geladen werden (HTTP ${res.status}). Vermutlich stimmt der hinterlegte service_role-Key nicht, oder die Tabelle <code>cal_bookings</code> ist noch nicht migriert.</p>`;
    const j = await res.json();
    rows = Array.isArray(j) ? j : [];
  } catch {
    return `<h1>Bookings</h1><p class="sub muted">Netzwerkfehler beim Laden der Bookings.</p>`;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const upcoming = rows.filter((r) => {
    const t = r.start_time ? new Date(r.start_time).getTime() : NaN;
    return !isNaN(t) && t >= now && r.status !== "CANCELLED";
  });
  const past7 = rows.filter((r) => {
    const t = r.created_at ? new Date(r.created_at).getTime() : NaN;
    return !isNaN(t) && now - t <= 7 * dayMs;
  });
  const cancelled = rows.filter((r) => r.status === "CANCELLED").length;

  const cards = `<div class="cards">
    <div class="card"><div class="k">Anstehend</div><div class="v">${upcoming.length}</div><div class="s">in der Zukunft</div></div>
    <div class="card"><div class="k">Letzte 7 Tage</div><div class="v">${past7.length}</div><div class="s">neue Buchungen</div></div>
    <div class="card"><div class="k">Storniert</div><div class="v">${cancelled}</div></div>
    <div class="card"><div class="k">Gesamt</div><div class="v">${rows.length}</div><div class="s">letzte 200</div></div>
  </div>`;

  const fmt = (s: unknown) => {
    const d = new Date(String(s));
    return isNaN(d.getTime())
      ? esc(s)
      : d.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
  };

  const pillFor = (r: CalBooking): string => {
    if (r.status === "CANCELLED") return `<span class="pill warn">storniert</span>`;
    const t = r.start_time ? new Date(r.start_time).getTime() : NaN;
    if (!isNaN(t) && t >= now) return `<span class="pill live">anstehend</span>`;
    return `<span class="pill">vergangen</span>`;
  };

  const body = rows.length
    ? rows
        .map(
          (r) => `<tr>
        <td class="muted" style="white-space:nowrap">${fmt(r.start_time)}</td>
        <td>${pillFor(r)}</td>
        <td>${esc(r.attendee_name || "")} ${r.attendee_email ? `<a class="applink" href="mailto:${esc(r.attendee_email)}">${esc(r.attendee_email)}</a>` : ""}</td>
        <td class="muted" style="font-size:12px;max-width:380px">${esc(r.title || r.event_type_slug || "")}</td>
        <td class="muted" style="font-size:12px">${esc(r.location || "")}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted">noch keine Buchungen. Cal-Webhook konfiguriert (Settings &rarr; Webhooks &rarr; <code>https://getklar.org/api/cal-webhook</code>)?</td></tr>`;

  return `<h1>Bookings</h1><p class="sub">Cal.com-Buchungen, per Webhook live in Supabase. Anstehende oben.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px 0">
      <a class="btn" href="https://cal.getklar.org/event-types" target="_blank" rel="noopener">Cal Admin öffnen ↗</a>
      <a class="btn" style="background:transparent;border:1px solid var(--line-strong);color:var(--fg)" href="https://cal.getklar.org/klar/affiliate-intro" target="_blank" rel="noopener">Booking-Seite ansehen ↗</a>
      <a class="btn" style="background:transparent;border:1px solid var(--line-strong);color:var(--fg)" href="https://cal.getklar.org/bookings/upcoming" target="_blank" rel="noopener">In Cal verwalten ↗</a>
    </div>
    ${cards}
    <table><thead><tr><th>Wann</th><th>Status</th><th>Gast</th><th>Event</th><th>Ort</th></tr></thead><tbody>${body}</tbody></table>`;
}

// ============================================================
// Templates View — per-app outreach templates (hashtags + Mail-1/2
// subject+body). Editable per (app_slug, language) row. Used by the
// Wave-Consumer to render Mail-1 and by Apify Discovery for hashtag-
// based crawl seeds. Welle-Starter form pre-fills from these defaults
// when the admin picks a single app + language.
// ============================================================

async function templatesView(): Promise<string> {
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
        ? `<span class="pill" style="background:#dcfce7;color:#166534;border-color:#bbf7d066;font-size:9px;font-weight:600">✓ M1</span>`
        : `<span class="pill" style="background:#fef9c3;color:#854d0e;border-color:#fde04766;font-size:9px;font-weight:600">M1 leer</span>`;
      const m2Badge = m2Done
        ? `<span class="pill" style="background:#dcfce7;color:#166534;border-color:#bbf7d066;font-size:9px;font-weight:600">✓ M2</span>`
        : `<span class="pill" style="background:#fef9c3;color:#854d0e;border-color:#fde04766;font-size:9px;font-weight:600">M2 leer</span>`;
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

// ============================================================
// Central Payouts View — aggregates batches across every wired-up app.
// Top: KPIs (open in REPORTING_CURRENCY, ready batches, FX pending, last paid). Then a
// "Alle vorbereiten" form that POSTs to /admin/dispatch-all. Then two
// tables: open/ready batches (with per-row Wise-prepare button) and the
// historic batches (paid/failed/cancelled).
// ============================================================
interface PayoutBatchRow {
  id: string | number;
  period_start: string;
  period_end: string;
  status: string;
  item_count: number;
  total_amount_cents: number;
  created_at?: string;
  paid_at?: string | null;
  dispatched_at?: string | null;
}

async function payoutsView(apps: AdminApp[]): Promise<string> {
  if (apps.length === 0) {
    return `<h1>Auszahlungen</h1><p class="sub">Keine Apps verdrahtet. Sobald <code>KLAR_ADMIN_APPS</code> im klar-Vercel-Projekt gesetzt ist und die jeweilige App ein Affiliate-Schema hat, tauchen Batches und gereifte Salden hier auf.</p>`;
  }

  const perApp = await Promise.all(apps.map(async (app) => {
    const [batches, claim] = await Promise.all([
      sbGet(app, "influencer_payout_batches?select=id,period_start,period_end,status,item_count,total_amount_cents,created_at,paid_at,dispatched_at&order=created_at.desc&limit=24"),
      sbGet(app, "influencer_claimable?select=claimable_eur_cents,unnormalized_events"),
    ]);
    const claimable = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);
    const fxPending = claim.reduce((s: number, c: any) => s + Number(c.unnormalized_events ?? 0), 0);
    return { app, batches: batches as PayoutBatchRow[], claimable, fxPending };
  }));

  type BatchWithApp = PayoutBatchRow & { app: AdminApp };
  const allBatches: BatchWithApp[] = perApp.flatMap((p) =>
    p.batches.map((b) => ({ ...b, app: p.app })),
  );
  const open = allBatches.filter((b) => b.status === "draft" || b.status === "awaiting_release");
  const dispatched = allBatches.filter((b) => b.status === "dispatched");
  const past = allBatches.filter((b) => b.status === "paid" || b.status === "failed" || b.status === "cancelled");
  const totalClaimable = perApp.reduce((s, p) => s + p.claimable, 0);
  const totalFxPending = perApp.reduce((s, p) => s + p.fxPending, 0);
  const totalOpenCents = open.reduce((s, b) => s + Number(b.total_amount_cents ?? 0), 0);
  const lastPaid = past.filter((b) => b.status === "paid")
    .sort((a, b) => String(b.paid_at ?? "").localeCompare(String(a.paid_at ?? "")))[0];

  const fmtDate = (s: unknown) => {
    const d = new Date(String(s));
    return isNaN(d.getTime())
      ? esc(s ?? "")
      : d.toLocaleDateString("de-CH", { dateStyle: "medium" });
  };

  const statusPill = (status: string): string => {
    if (status === "paid") return `<span class="pill live">bezahlt</span>`;
    if (status === "awaiting_release") return `<span class="pill">bereit</span>`;
    if (status === "dispatched") return `<span class="pill">unterwegs</span>`;
    if (status === "failed") return `<span class="warn">fehlgeschlagen</span>`;
    if (status === "cancelled") return `<span class="pill">storniert</span>`;
    if (status === "draft") return `<span class="pill">draft</span>`;
    return `<span class="pill">${esc(status)}</span>`;
  };

  const cards = `<div class="cards">
    <div class="card"><div class="k">Offen gesamt</div><div class="v">${eur(totalClaimable)}</div><div class="s">gereift, netto Refunds</div></div>
    <div class="card"><div class="k">Bereit zum Dispatch</div><div class="v">${open.length}</div><div class="s">${eur(totalOpenCents)} in ${perApp.filter(p=>p.batches.some(b=>b.status==="awaiting_release"||b.status==="draft")).length} App(s)</div></div>
    <div class="card"><div class="k">FX-Pending</div><div class="v">${totalFxPending}</div><div class="s">Events ohne EUR-Konversion</div></div>
    <div class="card"><div class="k">Letzte Zahlung</div><div class="v" style="font-size:18px">${lastPaid ? fmtDate(lastPaid.paid_at) : "—"}</div><div class="s">${lastPaid ? `${esc(lastPaid.app.name)} · ${eur(lastPaid.total_amount_cents)}` : "noch keine"}</div></div>
  </div>`;

  const readyCount = open.filter((b) => b.status === "awaiting_release").length;
  const dispatchAllBtn = readyCount > 0
    ? `<form method="POST" action="/admin/dispatch-all" style="margin:0 0 18px">
        <button class="btn" type="submit">Alle ${readyCount} bereiten Batches via Wise vorbereiten</button>
        <span class="muted" style="margin-left:12px;font-size:12px">ruft pro App wise-dispatch · Wise selber funden bleibt manueller Schritt</span>
      </form>`
    : "";

  const openRow = (b: BatchWithApp) => {
    const canDispatch = b.status === "draft" || b.status === "awaiting_release";
    return `<tr>
      <td><a class="applink" href="/admin?view=${esc(b.app.slug)}">${esc(b.app.name)}</a></td>
      <td>${fmtDate(b.period_start)} – ${fmtDate(b.period_end)}</td>
      <td class="r">${esc(b.item_count)}</td>
      <td class="r">${eur(b.total_amount_cents)}</td>
      <td>${statusPill(b.status)}</td>
      <td class="r">${canDispatch ? `<form method="POST" action="/admin/dispatch" style="display:inline"><input type="hidden" name="app" value="${esc(b.app.slug)}"/><input type="hidden" name="batch_id" value="${esc(b.id)}"/><button class="btn ghost" style="padding:5px 10px;font-size:11px" type="submit">via Wise</button></form>` : ""}</td>
    </tr>`;
  };

  const openTbl = open.length
    ? `<table><thead><tr><th>App</th><th>Periode</th><th class="r">Items</th><th class="r">Betrag</th><th>Status</th><th></th></tr></thead><tbody>${open.map(openRow).join("")}</tbody></table>`
    : `<p class="muted" style="font-size:13px">Keine offenen Batches. pg_cron baut am 1. des Monats neue.</p>`;

  const dispatchedTbl = dispatched.length
    ? `<table style="margin-top:16px"><thead><tr><th>App</th><th>Periode</th><th class="r">Items</th><th class="r">Betrag</th><th>Status</th><th>Reconcile</th></tr></thead><tbody>${dispatched.map((b) => `<tr>
      <td><a class="applink" href="/admin?view=${esc(b.app.slug)}">${esc(b.app.name)}</a></td>
      <td>${fmtDate(b.period_start)} – ${fmtDate(b.period_end)}</td>
      <td class="r">${esc(b.item_count)}</td>
      <td class="r">${eur(b.total_amount_cents)}</td>
      <td>${statusPill(b.status)}</td>
      <td class="r"><form method="POST" action="/admin/reconcile" style="display:inline"><input type="hidden" name="app" value="${esc(b.app.slug)}"/><button class="btn ghost" style="padding:5px 10px;font-size:11px" type="submit">Status holen</button></form></td>
    </tr>`).join("")}</tbody></table>`
    : "";

  const historyTbl = past.length
    ? `<table><thead><tr><th>App</th><th>Periode</th><th class="r">Items</th><th class="r">Betrag</th><th>Status</th><th>Bezahlt am</th></tr></thead><tbody>${past
        .slice(0, 24)
        .map((b) => `<tr>
          <td><a class="applink" href="/admin?view=${esc(b.app.slug)}">${esc(b.app.name)}</a></td>
          <td>${fmtDate(b.period_start)} – ${fmtDate(b.period_end)}</td>
          <td class="r">${esc(b.item_count)}</td>
          <td class="r">${eur(b.total_amount_cents)}</td>
          <td>${statusPill(b.status)}</td>
          <td class="muted">${b.paid_at ? fmtDate(b.paid_at) : "—"}</td>
        </tr>`).join("")}</tbody></table>`
    : `<p class="muted" style="font-size:13px">Noch keine Historie.</p>`;

  return `<h1>Auszahlungen</h1><p class="sub">Alle Affiliate-Auszahlungsbatches über alle verdrahteten Apps hinweg. Bereitstellen läuft pro App über deren Wise-Edge-Function, Funden bleibt manueller Schritt im Wise-Dashboard.</p>
    ${cards}
    <h2>Offen · bereit zum Dispatch</h2>
    ${dispatchAllBtn}
    ${openTbl}
    ${dispatched.length ? `<h2>Unterwegs · awaiting Wise</h2>${dispatchedTbl}` : ""}
    <h2>Historie</h2>
    ${historyTbl}`;
}

function calView(): string {
  // Full-bleed iframe of cal.getklar.org. Nginx is configured to send
  // Content-Security-Policy: frame-ancestors 'self' https://getklar.org so
  // the embed is permitted. User must sign in once inside the iframe; the
  // session cookie persists on the cal.getklar.org domain afterwards.
  return `<div style="margin:-24px -28px -28px -28px;height:calc(100vh - 56px);position:relative">
    <iframe
      src="https://cal.getklar.org"
      title="Cal Admin"
      style="width:100%;height:100%;border:0;display:block;background:var(--surface)"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-storage-access-by-user-activation"
      allow="clipboard-read; clipboard-write; camera; microphone"
      referrerpolicy="origin"
    ></iframe>
  </div>`;
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
  else if (view === "bookings") main = await bookingsView();
  else if (view === "cal") main = calView();
  else if (view === "revenue") main = await revenueView(apps);
  else if (view === "payouts") main = await payoutsView(apps);
  else if (view === "templates") main = await templatesView();
  else {
    const app = apps.find((a) => a.slug === view);
    main = app ? await appView(app) : await overview(apps);
  }

  return doc(shell(view, apps, flash, main));
}
