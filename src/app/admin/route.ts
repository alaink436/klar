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
import { KLAR_APPS, type KlarAppMeta } from "../../lib/klarApps";
import {
  getOutreachStats,
  getOutreachPerAppStats,
  listOutreachTargets,
  isOutreachConfigured,
  type OutreachPlatform,
  type OutreachStatus,
  type OutreachTarget,
  type PerAppStat,
} from "../../lib/outreachStore";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  checkAuth,
  esc,
} from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
${inner}
<script>
${THEME_TOGGLE_SCRIPT}
${SMOKE_BG_SCRIPT}
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
    const [inf, claim] = await Promise.all([
      sbGet(app, "influencers?select=status"),
      sbGet(app, "influencer_claimable?select=claimable_eur_cents,unnormalized_events"),
    ]);
    const onboarded = inf.length > 0 || claim.length > 0;
    const active = inf.filter((i: any) => i.status === "active").length;
    const open = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);
    const fx = claim.reduce((s: number, c: any) => s + Number(c.unnormalized_events ?? 0), 0);
    return { app, onboarded, total: inf.length, active, open, fx };
  }));
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const totalAff = rows.reduce((s, r) => s + r.total, 0);
  const cards = `<div class="cards">
    <div class="card"><div class="k">Apps verdrahtet</div><div class="v">${rows.length}/${KLAR_APPS.length}</div><div class="s">${rows.filter(r=>r.onboarded).length} mit Daten</div></div>
    <div class="card"><div class="k">Affiliates gesamt</div><div class="v">${totalAff}</div></div>
    <div class="card"><div class="k">Offen gesamt</div><div class="v">${eur(totalOpen)}</div><div class="s">netto, gereift</div></div>
  </div>`;
  const tbl = `<table><thead><tr><th>App</th><th class="r">Affiliates</th><th class="r">Aktiv</th><th class="r">Offen (${esc(REPORTING_CURRENCY)})</th><th class="c">FX</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr>
      <td><a class="applink" href="/admin?view=${esc(r.app.slug)}">${esc(r.app.name)}</a> ${r.onboarded ? "" : `<span class="pill">nicht ausgerollt</span>`}</td>
      <td class="r">${r.total}</td><td class="r">${r.active}</td>
      <td class="r">${eur(r.open)}</td>
      <td class="c">${r.fx > 0 ? `<span class="warn">${r.fx}</span>` : "ok"}</td>
      <td class="r"><a class="pill" href="/admin?view=${esc(r.app.slug)}">öffnen</a></td>
    </tr>`).join("")}
  </tbody></table>`;
  return `<h1>Übersicht</h1><p class="sub">Alle Klar-Apps auf einen Blick. Wähl eine verdrahtete App fürs Affiliate-Detail.</p>${tabs}<h2>Affiliate-Stand</h2>${cards}${tbl}`;
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
  const [inf, claim, batches] = await Promise.all([
    listInfluencers(app),
    sbGet(app, "influencer_claimable?select=handle,status,payout_method,matured_share_eur_cents,paid_eur_cents,claimable_eur_cents,unnormalized_events&order=claimable_eur_cents.desc"),
    sbGet(app, "influencer_payout_batches?select=id,period_start,period_end,status,item_count,total_amount_cents&order=created_at.desc&limit=8"),
  ]);
  if (inf.length === 0 && claim.length === 0 && batches.length === 0)
    return `<h1>${esc(app.name)}</h1><p class="sub muted">Für diese App ist noch kein Affiliate-Schema in Supabase ausgerollt, darum gibt es noch keine Daten.</p>`;
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
      buttons.push(`<form method="POST" action="/admin/influencer/suspend" style="display:inline" onsubmit="return confirm('Suspend @${handle}? Bestehende Payouts laufen aus, neue Events kriegen counts_for_payout=false.');">
        <input type="hidden" name="app" value="${slug}"/>
        <input type="hidden" name="handle" value="${handle}"/>
        <input type="hidden" name="status" value="suspended"/>
        <button type="submit" class="btn ghost" style="padding:3px 9px;font-size:11px;color:var(--danger)">Suspend</button>
      </form>`);
      buttons.push(`<form method="POST" action="/admin/influencer/suspend" style="display:inline" onsubmit="return confirm('PERMANENT BAN für @${handle}? Wie Suspend, aber als bleibend markiert.');">
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
    // Hard delete nur erlauben wenn pending (kein referral/event history yet)
    if (i.status === "pending") {
      buttons.push(`<form method="POST" action="/admin/influencer/delete" style="display:inline" onsubmit="return confirm('HART LÖSCHEN @${handle}? Geht nur wenn keine referrals/events existieren. Bei Active/Suspended bitte ban statt delete.');">
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
        return `<tr>
          <td>${esc(i.handle)}<div class="muted" style="font-size:11px">${esc(i.display_name ?? "")}${i.promo_code ? ` · code <strong>${esc(i.promo_code)}</strong>` : ""}</div></td>
          <td>${infStatusPill(i.status)} ${setupBadge}</td>
          <td>${esc(i.contact_email ?? "—")}</td>
          <td>${esc(i.payout_method ?? "—")}<div class="muted" style="font-size:11px">${esc(i.country ?? "")}</div></td>
          <td class="r">${sharePct !== null ? `${sharePct}%` : "—"}${i.share_months ? `<div class="muted" style="font-size:11px">${i.share_months}mo</div>` : ""}</td>
          <td class="r" style="white-space:nowrap">${infActions(i)}</td>
        </tr>`;
      }).join("");

  return `<h1>${esc(app.name)}</h1><p class="sub">Affiliate-Salden, Auszahlungen und Affiliates für ${esc(app.name)}.</p>${cards}
    <form method="POST" action="/admin/reconcile" style="margin:0 0 18px"><input type="hidden" name="app" value="${esc(app.slug)}"/><button class="btn ghost" type="submit">Status aktualisieren · Wise nach DB</button></form>
    <h2>Affiliates <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${inf.length} Einträge</span></h2>
    <table>
      <thead><tr><th>Handle</th><th>Status</th><th>Email</th><th>Auszahlung</th><th class="r">Share</th><th class="r">Aktionen</th></tr></thead>
      <tbody>${infRows}</tbody>
    </table>
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

async function outreachView(
  filterPlatform: string,
  filterStatus: string,
  filterApp: string,
  query: string,
  autoRefresh: boolean,
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

  const [stats, perApp, rows] = await Promise.all([
    getOutreachStats(),
    getOutreachPerAppStats(),
    listOutreachTargets({ platform, status, app, query: q, limit: 200 }),
  ]);

  // Auto-refresh meta-tag (15s). Toggle via ?ar=0.
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

  // Filter-Strip: hält query+autoRefresh-Param mit
  const buildFilterHref = (p: string, s: string, a: string): string => {
    const parts: string[] = ["view=outreach"];
    if (p !== "all") parts.push(`p=${encodeURIComponent(p)}`);
    if (s !== "all") parts.push(`s=${encodeURIComponent(s)}`);
    if (a !== "all") parts.push(`a=${encodeURIComponent(a)}`);
    if (q) parts.push(`q=${encodeURIComponent(q)}`);
    if (!autoRefresh) parts.push(`ar=0`);
    return `/admin?${parts.join("&")}`;
  };
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
    ${!autoRefresh ? `<input type="hidden" name="ar" value="0"/>` : ""}
    <input type="search" name="q" value="${esc(q)}" placeholder="Suche handle / display name / niche / notes…" maxlength="80" style="flex:1;padding:8px 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);color:var(--fg);font-size:13px"/>
    <button type="submit" class="btn ghost" style="padding:7px 12px;font-size:12px">Suchen</button>
    ${q ? `<a href="${buildFilterHref(platform, status, app).replace(/&?q=[^&]*/, "")}" class="btn ghost" style="padding:7px 10px;font-size:12px">×</a>` : ""}
  </form>`;

  // Auto-Refresh Toggle
  const refreshToggle = `<div class="seg" style="margin-left:auto">
    <a href="${(() => {
      const parts: string[] = ["view=outreach"];
      if (platform !== "all") parts.push(`p=${encodeURIComponent(platform)}`);
      if (status !== "all") parts.push(`s=${encodeURIComponent(status)}`);
      if (app !== "all") parts.push(`a=${encodeURIComponent(app)}`);
      if (q) parts.push(`q=${encodeURIComponent(q)}`);
      return `/admin?${parts.join("&")}`;
    })()}" class="${autoRefresh ? "on" : ""}" title="Auto-Refresh alle 15 Sekunden">15s ⟲</a>
    <a href="${(() => {
      const parts: string[] = ["view=outreach", "ar=0"];
      if (platform !== "all") parts.push(`p=${encodeURIComponent(platform)}`);
      if (status !== "all") parts.push(`s=${encodeURIComponent(status)}`);
      if (app !== "all") parts.push(`a=${encodeURIComponent(app)}`);
      if (q) parts.push(`q=${encodeURIComponent(q)}`);
      return `/admin?${parts.join("&")}`;
    })()}" class="${!autoRefresh ? "on" : ""}" title="Manueller Refresh">Pause</a>
  </div>`;

  // Per-App-Stats-Tabelle
  const perAppMap = new Map(perApp.map((p) => [p.app, p]));
  const perAppRows = KLAR_APPS.map((meta) => {
    const r = perAppMap.get(meta.slug);
    if (!r) return `<tr>
      <td><a class="applink" href="${buildFilterHref(platform, status, meta.slug)}">${esc(meta.name)}</a></td>
      <td colspan="7" class="muted" style="font-style:italic">noch keine Targets</td>
    </tr>`;
    return `<tr>
      <td><a class="applink" href="${buildFilterHref(platform, status, meta.slug)}">${esc(meta.name)}</a></td>
      <td class="r">${r.total}</td>
      <td class="r"><span class="muted">${r.queued}</span></td>
      <td class="r">${r.contacted}<div class="muted" style="font-size:10px">${r.contacted_last_7d} (7d)</div></td>
      <td class="r">${r.replied}</td>
      <td class="r"><strong>${r.converted}</strong></td>
      <td class="r">${r.mails_total}</td>
      <td class="r"><span class="muted">${r.declined + r.dead}</span></td>
    </tr>`;
  }).join("");
  const perAppTable = `<table>
    <thead><tr><th>App</th><th class="r">Total</th><th class="r">Queued</th><th class="r">Kontaktiert</th><th class="r">Repl.</th><th class="r">Conv.</th><th class="r">Mails</th><th class="r">Tot/Dead</th></tr></thead>
    <tbody>${perAppRows}</tbody>
  </table>`;

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

    // Status-Quick-Actions: nur Vorwärts-Pfeile zeigen, basierend auf aktuellem Status.
    const actions: { label: string; status: OutreachStatus }[] = [];
    if (t.status === "queued")  actions.push({ label: "DM ✓", status: "dm_sent" });
    if (t.status === "dm_sent") actions.push(
      { label: "Antwort", status: "replied" },
      { label: "Abgelehnt", status: "declined" },
      { label: "Dead", status: "dead" },
    );
    if (t.status === "replied") actions.push(
      { label: "Converted", status: "converted" },
      { label: "Abgelehnt", status: "declined" },
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

    const deleteForm = `<form method="POST" action="/admin/outreach/delete" style="display:inline" onsubmit="return confirm('Lead @${esc(t.handle)} löschen?')">
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
      <td class="r" style="white-space:nowrap">${actionForms} ${mailForm} ${deleteForm}</td>
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

  return `${refreshMeta}<h1>Outreach</h1>
    <p class="sub">Influencer-Outreach-Tracker. <em>Queued → DM gesendet → Antwort → Converted</em>. Auto-Refresh ${autoRefresh ? "alle 15s" : "aus"}, Daten aus Supabase anime-vault.</p>
    ${cards}
    <h2>Pro App</h2>
    ${perAppTable}
    ${addForm}
    <h2>Filter</h2>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;align-items:center">
      ${searchForm}
      ${refreshToggle}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">${segPlatform}${segStatus}</div>
    <div style="margin-bottom:18px">${segApp}</div>
    <h2>Targets <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${rows.length} angezeigt${q ? ` · Suche: <em>${esc(q)}</em>` : ""}</span></h2>
    <table>
      <thead><tr><th>Lead</th><th>Plattform</th><th class="r">Follower</th><th class="r">Views</th><th>Apps</th><th>Status</th><th class="r">Aktionen</th></tr></thead>
      <tbody>${tableBody}</tbody>
    </table>`;
}

async function inboxView(typeFilter: string, sourceFilter: string): Promise<string> {
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

  // Filter rows by selected type + source (both default "all")
  const effectiveType = typeFilter === "consulting" || typeFilter === "affiliate" ? typeFilter : "all";
  const effectiveSource = sourceFilter && sourceFilter !== "all" ? sourceFilter : "all";
  const rows = rowsAll.filter((r) => {
    if (effectiveType !== "all" && r.type !== effectiveType) return false;
    if (effectiveSource !== "all" && (r.source ?? "") !== effectiveSource) return false;
    return true;
  });

  // Build aggregate counts so filter tabs/pills show live totals.
  const totalsByType: Record<string, number> = { all: rowsAll.length, affiliate: 0, consulting: 0 };
  const totalsBySource: Record<string, number> = { all: rowsAll.length };
  for (const k of SOURCE_KEYS) totalsBySource[k] = 0;
  totalsBySource["unknown"] = 0;
  let nNew = 0;
  for (const r of rowsAll) {
    if (r.type === "affiliate") totalsByType.affiliate++;
    if (r.type === "consulting") totalsByType.consulting++;
    const s = r.source ?? "";
    if (s && totalsBySource[s] !== undefined) totalsBySource[s]++;
    else if (!s) totalsBySource["unknown"]++;
    else totalsBySource[s] = (totalsBySource[s] ?? 0) + 1;
    if (r.status === "new") nNew++;
  }

  // Filter UI: type-tabs (Alle / Affiliate / Consulting) + source-pills below.
  const buildHref = (t: string, s: string) =>
    `/admin?view=inbox${t !== "all" ? `&type=${t}` : ""}${s !== "all" ? `&source=${encodeURIComponent(s)}` : ""}`;
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
  const detail = (r: Inquiry) =>
    (r.type === "affiliate"
      ? [
          r.handle && `handle: ${r.handle}`,
          r.audience && `audience: ${r.audience}`,
          r.platforms && `plat: ${r.platforms}`,
          r.why && `why: ${r.why}`,
        ]
      : [
          r.name && `name: ${r.name}`,
          r.project && `project: ${r.project}`,
          r.budget && `budget: ${r.budget}`,
          r.brief && `brief: ${r.brief}`,
        ]
    )
      .filter(Boolean)
      .join(" · ");

  // Apps that are wired up (KLAR_ADMIN_APPS env). Used to populate the
  // approve-form select. If KLAR_ADMIN_APPS is empty, the dropdown still
  // shows but submitting will return "unknown app" — that's the cue to add
  // the app's slug+serviceKey to the env first.
  const allWiredApps = getApps();
  // Per-inquiry rendering of the option list: pre-selects the influencer's
  // target_app if set (via the public form dropdown). Falls back to "wählen"
  // when the field is missing/empty.
  const wiredOptionsFor = (target: string | undefined): string =>
    allWiredApps
      .map(
        (a) =>
          `<option value="${esc(a.slug)}"${a.slug === target ? " selected" : ""}>${esc(a.name)}</option>`,
      )
      .join("");

  // Onboarding-Link delegated to lib/adminApps.setupLandingUrl() so there is
  // exactly one place that knows the per-app host. The old in-line table
  // here drifted from the canonical one (myloo.app vs myloo.org) which
  // would have rendered dead admin links for the wrong app.
  const setupLinkFor = (slug: string, token: string): string => setupLandingUrl(slug, token);

  const approveForm = (r: Inquiry): string => {
    if (r.type !== "affiliate") return "";

    // Already invited (or active): show the setup-link so the admin can
    // re-copy it and send it again if needed.
    if ((r.status === "invited" || r.status === "approved" || r.status === "active") && r.approved_app && r.approved_code) {
      const link = setupLinkFor(r.approved_app, r.approved_code);
      const isLive = r.status === "active";
      return `<tr class="approved-row"><td colspan="6" style="padding:10px 14px;background:var(--surface-2);border-top:1px solid var(--line)">
        <span class="pill" style="background:${isLive ? "#dcfce7" : "#dbeafe"};color:${isLive ? "#166534" : "#1e40af"};border:1px solid ${isLive ? "#bbf7d0" : "#bfdbfe"};font-weight:600">${isLive ? "✓ active" : "→ invited"} · ${esc(r.approved_app)}</span>
        <a class="applink" style="margin-left:10px;font-family:ui-monospace,monospace;font-size:12px" href="${link}" target="_blank" rel="noopener">${link} ↗</a>
        <button type="button" class="btn" style="margin-left:8px;padding:4px 10px;font-size:11px" onclick="navigator.clipboard.writeText('${link}').then(()=>this.textContent='✓ copied').catch(()=>this.textContent='copy failed')">Copy link</button>
        ${r.approved_at ? `<span class="muted" style="margin-left:10px;font-size:12px">${fmt(r.approved_at)}</span>` : ""}
      </td></tr>`;
    }

    if (!r.id) return "";
    const displayName = r.handle || (r.email ?? "").split("@")[0] || "";
    return `<tr class="approve-row"><td colspan="6" style="padding:10px 14px;background:var(--surface-2);border-top:1px solid var(--line)">
      <form method="POST" action="/api/affiliate/approve" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">
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
        <button type="submit" class="btn" style="padding:8px 16px;font-size:13px">Generate onboarding link →</button>
      </form>
    </td></tr>`;
  };

  const body = rows.length
    ? rows
        .map((r) => {
          const isLive = r.status === "active";
          const isInvited = r.status === "invited" || r.status === "approved";
          const statusPill = isLive
            ? `<span class="pill" style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0;font-weight:600">active</span>`
            : isInvited
            ? `<span class="pill" style="background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;font-weight:600">invited</span>`
            : `<span class="pill ${r.status === "new" ? "live" : ""}">${esc(r.status ?? "")}</span>`;
          return `<tr>
        <td class="muted" style="white-space:nowrap">${fmt(r.created_at)}</td>
        <td><span class="pill ${r.status === "new" && r.type === "affiliate" ? "live" : ""}">${esc(r.type)}</span></td>
        <td>${sourcePill(r.source)}</td>
        <td><a class="applink" href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
        <td class="muted" style="font-size:12px;max-width:480px">${esc(detail(r))}</td>
        <td>${statusPill}</td>
      </tr>${approveForm(r)}`;
        })
        .join("")
    : `<tr><td colspan="6" class="muted">keine Anfragen in dieser Auswahl. ${effectiveType !== "all" || effectiveSource !== "all" ? `<a class="applink" href="/admin?view=inbox">Filter zurücksetzen</a>` : ""}</td></tr>`;

  const consultingHint = effectiveType === "consulting"
    ? `<p class="sub muted" style="margin:0 0 16px;font-size:13px">Consulting-Calls aus Cal.com (consulting + coaching event types) erscheinen unter <a class="applink" href="/admin?view=bookings">Bookings</a>. Hier nur die schriftlichen Anfragen vom Kontaktformular.</p>`
    : "";

  return `<h1>Inbox</h1><p class="sub">Affiliate- und Consulting-Anfragen, gefiltert nach Typ und Quelle. Affiliate-Zeilen ohne Onboarding-Link haben darunter ein Formular: App wählen, Handle/Sprache prüfen, <em>Generate onboarding link</em> klicken — generiert einen 7-Tage-Setup-Token im App-Supabase und zeigt dir den Link zum Versenden an den Influencer.</p>
    ${typeTabs}
    ${sourceFilters}
    ${consultingHint}
    ${cards}
    <table><thead><tr><th>Wann</th><th>Typ</th><th>Quelle</th><th>Email</th><th>Details</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
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
    // Auto-Refresh default-on; ?ar=0 schaltet es aus (persistiert via URL state)
    const ar = (url.searchParams.get("ar") ?? "1") !== "0";
    main = await outreachView(p, s, a, q, ar);
  }
  else if (view === "inbox") {
    const typeFilter = url.searchParams.get("type") ?? "all";
    const sourceFilter = url.searchParams.get("source") ?? "all";
    main = await inboxView(typeFilter, sourceFilter);
  }
  else if (view === "bookings") main = await bookingsView();
  else if (view === "cal") main = calView();
  else if (view === "revenue") main = await revenueView(apps);
  else if (view === "payouts") main = await payoutsView(apps);
  else {
    const app = apps.find((a) => a.slug === view);
    main = app ? await appView(app) : await overview(apps);
  }

  return doc(shell(view, apps, flash, main));
}
