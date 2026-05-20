// Central Klar payout control-plane. Server-rendered, no client JS, all
// secrets server-side. Gated by KLAR_ADMIN_KEY (query ?key= once -> cookie).
// Views via ?view= : overview | revenue | <app-slug> | outreach
//
// Styling mirrors the klar brand (oklch tokens, editorial brutalism).
// Fonts: Space Grotesk (display) + Inter (UI) + Instrument Serif (italic
// intros), via Google Fonts. Restrained magenta accent for orientation.
// Revenue chart is server-rendered SVG (no client JS).
//
// Env: KLAR_ADMIN_KEY, KLAR_ADMIN_APPS (JSON registry, see lib/adminApps),
//      KLAR_OUTREACH_SHEET_ID (optional, defaults to the Marketing master).

import { createSign } from "node:crypto";
import { getApps, sbGet, type AdminApp } from "../../lib/adminApps";
import { KLAR_APPS, type KlarAppMeta } from "../../lib/klarApps";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  GLASS_SVG_DEFS,
  SMOKE_BG_SCRIPT,
  ctEqual,
  readCookie,
  esc,
} from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KLAR_ADMIN_KEY = process.env.KLAR_ADMIN_KEY ?? "";
// Google Sheets read for the Outreach view. Whole service-account JSON key
// file content in one Vercel env var (KLAR_SHEETS_SA_JSON) so the escaped
// \n in private_key survive via JSON.parse. Never in the repo/chat. Without
// it the Outreach view degrades to the embedded-iframe-only fallback.
const KLAR_SHEETS_SA = process.env.KLAR_SHEETS_SA_JSON ?? "";
const OUTREACH_SHEET_ID =
  process.env.KLAR_OUTREACH_SHEET_ID ?? "16MLUtfYVDzbu3bxjntilRqD_XjHSaRmypwpj1Rarx0c";

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
  // Approval columns added 2026-05-20 via klar_inquiries_approval_columns:
  approved_app?: string;
  approved_code?: string;
  approved_at?: string;
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

function loginPage(err?: string): Response {
  return doc(`<div class="login">
    <div class="login-card">
      <div class="login-badge" aria-hidden="true" style="width:56px;height:56px;padding:6px"><img src="/logo/klar-symbol.png" alt="Klar" style="width:100%;height:100%;object-fit:contain;display:block"/></div>
      <div class="login-mark">Klar</div>
      <p class="login-tag">Das Kontrollzentrum hinter dem Studio.</p>
      <div class="login-rule"></div>
      ${err ? `<p class="login-err">${esc(err)}</p>` : ""}
      <form method="GET" action="/admin">
        <input class="login-input" name="key" type="password" placeholder="Admin-Key" autofocus autocomplete="current-password"/>
        <button class="btn" style="margin-top:14px;width:100%;padding:12px;justify-content:center" type="submit">Anmelden</button>
      </form>
      <p class="login-foot">Intern · getklar.org</p>
    </div></div>`);
}

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
    sbGet(app, "influencers?select=handle,status"),
    sbGet(app, "influencer_claimable?select=handle,status,payout_method,matured_share_eur_cents,paid_eur_cents,claimable_eur_cents,unnormalized_events&order=claimable_eur_cents.desc"),
    sbGet(app, "influencer_payout_batches?select=id,period_start,period_end,status,item_count,total_amount_cents&order=created_at.desc&limit=8"),
  ]);
  if (inf.length === 0 && claim.length === 0 && batches.length === 0)
    return `<h1>${esc(app.name)}</h1><p class="sub muted">Für diese App ist noch kein Affiliate-Schema in Supabase ausgerollt, darum gibt es noch keine Daten.</p>`;
  const active = inf.filter((i: any) => i.status === "active").length;
  const open = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);
  const ids = batches.map((b: any) => b.id);
  const items = ids.length
    ? await sbGet(app, `influencer_payout_items?batch_id=in.(${ids.join(",")})&select=batch_id,influencer_handle,amount_cents,payout_method,status,provider_ref,provider_error&order=created_at.desc`)
    : [];
  const cards = `<div class="cards">
    <div class="card"><div class="k">Affiliates</div><div class="v">${inf.length}</div><div class="s">${active} aktiv</div></div>
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
  return `<h1>${esc(app.name)}</h1><p class="sub">Affiliate-Salden und Auszahlungen für ${esc(app.name)}.</p>${cards}
    <form method="POST" action="/admin/reconcile" style="margin:0 0 18px"><input type="hidden" name="app" value="${esc(app.slug)}"/><button class="btn ghost" type="submit">Status aktualisieren · Wise nach DB</button></form>
    <table><thead><tr><th>Handle</th><th>Status</th><th>Methode</th><th class="r">Gereift</th><th class="r">Bezahlt</th><th class="r">Offen</th><th class="c">FX</th></tr></thead><tbody>${claimRows}</tbody></table>
    <h2>Batches</h2>${batchHtml || `<p class="muted">noch keine Batches (pg_cron baut am 1. des Monats)</p>`}`;
}

// ---- Google Sheets via service account, zero extra deps -------------------
let sheetsTok: { token: string; exp: number } | null = null;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sheetsToken(): Promise<string | null> {
  if (sheetsTok && sheetsTok.exp > Date.now() + 30_000) return sheetsTok.token;
  let creds: { client_email?: string; private_key?: string };
  try {
    creds = JSON.parse(KLAR_SHEETS_SA);
  } catch {
    return null;
  }
  if (!creds.client_email || !creds.private_key) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  let signature: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    signer.end();
    signature = b64url(signer.sign(creds.private_key));
  } catch {
    return null;
  }
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claim}.${signature}`,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.access_token) return null;
    sheetsTok = {
      token: j.access_token,
      exp: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000,
    };
    return sheetsTok.token;
  } catch {
    return null;
  }
}

async function sheetsApi(path: string, token: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${path}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const sheetRange = (title: string) =>
  encodeURIComponent(`'${title.replace(/'/g, "''")}'`);

async function outreachStats(): Promise<string> {
  const token = await sheetsToken();
  if (!token) return "";
  const meta = await sheetsApi(
    `${OUTREACH_SHEET_ID}?fields=${encodeURIComponent("sheets(properties(title))")}`,
    token,
  );
  const tabs: string[] = (meta?.sheets ?? [])
    .map((s: any) => String(s?.properties?.title ?? ""))
    .filter((t: string) => t)
    .slice(0, 25);
  if (tabs.length === 0) return "";
  const ranges = tabs.map((t) => `ranges=${sheetRange(t)}`).join("&");
  const vals = await sheetsApi(
    `${OUTREACH_SHEET_ID}/values:batchGet?${ranges}&majorDimension=ROWS`,
    token,
  );
  const vr: any[] = vals?.valueRanges ?? [];

  const STAT = ["to-contact", "contacted", "replied", "posted"];
  const agg: Record<string, number> = {};
  let totRows = 0;
  const rows = tabs.map((title, i) => {
    const grid: string[][] = vr[i]?.values ?? [];
    const header = (grid[0] ?? []).map((h) => String(h).trim().toLowerCase());
    const body = grid
      .slice(1)
      .filter((r) => r.some((c) => String(c ?? "").trim()));
    totRows += body.length;
    const si = header.findIndex((h) => h.includes("status"));
    let tally = "";
    if (si >= 0) {
      const counts: Record<string, number> = {};
      for (const r of body) {
        const v = String(r[si] ?? "").trim().toLowerCase();
        if (!v) continue;
        counts[v] = (counts[v] ?? 0) + 1;
        agg[v] = (agg[v] ?? 0) + 1;
      }
      tally = STAT.filter((k) => counts[k])
        .map((k) => `<span class="pill">${esc(k)} ${counts[k]}</span>`)
        .join(" ");
      const extra = Object.keys(counts)
        .filter((k) => !STAT.includes(k))
        .reduce((s, k) => s + counts[k], 0);
      if (extra) tally += ` <span class="pill">andere ${extra}</span>`;
    }
    return `<tr><td>${esc(title)}</td><td class="r">${body.length}</td><td>${tally || '<span class="muted">kein Status-Feld</span>'}</td></tr>`;
  });

  const aggChips =
    STAT.filter((k) => agg[k])
      .map((k) => `<span class="pill">${esc(k)} ${agg[k]}</span>`)
      .join(" ") || '<span class="muted">keine Status-Spalten erkannt</span>';

  return `<div class="cards">
      <div class="card"><div class="k">App-Tabs</div><div class="v">${tabs.length}</div></div>
      <div class="card"><div class="k">Kontakte gesamt</div><div class="v">${totRows}</div><div class="s">Zeilen mit Inhalt</div></div>
      <div class="card"><div class="k">Status gesamt</div><div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${aggChips}</div></div>
    </div>
    <h2>Pro App-Tab</h2>
    <table><thead><tr><th>Tab</th><th class="r">Kontakte</th><th>Status</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

async function outreachView(): Promise<string> {
  const v = `https://docs.google.com/spreadsheets/d/${OUTREACH_SHEET_ID}/preview`;
  const edit = `https://docs.google.com/spreadsheets/d/${OUTREACH_SHEET_ID}/edit`;
  let stats = "";
  let hint = "";
  if (KLAR_SHEETS_SA) {
    stats = await outreachStats();
    if (!stats)
      hint = `<p class="sub muted" style="font-size:14px">Service-Account-Stats nicht ladbar. Key gültig? Sheet mit der SA-Mail als Betrachter geteilt? Solange greift das eingebettete Sheet unten.</p>`;
  } else {
    hint = `<p class="sub muted" style="font-size:14px">Für automatische Zahlen pro App: <span class="warn">KLAR_SHEETS_SA_JSON</span> (kompletter Dienstkonto-JSON-Key) im klar-Vercel-Projekt setzen + Sheet mit der SA-Mail als Betrachter teilen. Bis dahin nur das eingebettete Sheet.</p>`;
  }
  return `<h1>Outreach</h1><p class="sub">Der Influencer-Outreach-Master. Jeder App-Tab führt den Status: To-Contact, Contacted, Replied, Posted.</p>
    ${stats}
    ${hint}
    <h2>Volles Sheet</h2>
    <div style="margin-bottom:16px"><a class="btn" target="_blank" rel="noopener" href="${edit}">In Google Sheets öffnen</a></div>
    <div class="iframewrap"><iframe src="${v}" loading="lazy"></iframe></div>
    <p class="sub muted" style="margin-top:16px;font-size:14px">Das eingebettete Sheet lädt nur, wenn du im selben Browser beim berechtigten Google-Account angemeldet bist.</p>`;
}

async function inboxView(): Promise<string> {
  if (!KLAR_INBOX_KEY)
    return `<h1>Inbox</h1><p class="sub muted">Fast fertig, es fehlt nur der Lese-Key. Setze <span class="warn">KLAR_INBOX_SERVICE_KEY</span> im klar-Vercel-Projekt (Wert: anime-vault &rarr; Settings &rarr; API &rarr; <em>service_role</em>). Optional <span class="warn">KLAR_INBOX_SUPABASE_URL</span>. Anfragen werden schon dauerhaft gespeichert, nur die Anzeige hier braucht den Key.</p>`;
  let rows: Inquiry[] = [];
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
    rows = Array.isArray(j) ? j : [];
  } catch {
    return `<h1>Inbox</h1><p class="sub muted">Netzwerkfehler beim Laden der Inbox. Einmal neu laden hilft meist.</p>`;
  }

  const nNew = rows.filter((r) => r.status === "new").length;
  const aff = rows.filter((r) => r.type === "affiliate").length;
  const con = rows.filter((r) => r.type === "consulting").length;
  const cards = `<div class="cards">
    <div class="card"><div class="k">Neu</div><div class="v">${nNew}</div><div class="s">ungelesen</div></div>
    <div class="card"><div class="k">Affiliate</div><div class="v">${aff}</div></div>
    <div class="card"><div class="k">Consulting</div><div class="v">${con}</div></div>
    <div class="card"><div class="k">Gesamt</div><div class="v">${rows.length}</div><div class="s">letzte 200</div></div>
  </div>`;

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
  const wiredApps = getApps()
    .map((a) => `<option value="${esc(a.slug)}">${esc(a.name)}</option>`)
    .join("");

  // Random code suggestion — 6 uppercase chars, no ambiguous 0/O/1/I/L.
  const suggestCode = (handle: string): string => {
    const seed = (handle || "X").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "REF";
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let tail = "";
    for (let i = 0; i < 3; i++) tail += chars[Math.floor(Math.random() * chars.length)];
    return `${seed}${tail}`.slice(0, 6);
  };

  const approveForm = (r: Inquiry): string => {
    if (r.type !== "affiliate") return "";
    if (r.status === "approved" && r.approved_app && r.approved_code) {
      const landing = `https://getklar.org/i/${esc(r.approved_app)}/${esc(r.approved_code)}`;
      return `<tr class="approved-row"><td colspan="5" style="padding:8px 14px;background:var(--surface-2);border-top:1px solid var(--line)">
        <span class="pill" style="background:var(--ok-soft,#dcfce7);color:#166534;border:1px solid #bbf7d0;font-weight:600">approved → ${esc(r.approved_app)}</span>
        <span class="mono" style="margin-left:10px">${esc(r.approved_code)}</span>
        <a class="applink" style="margin-left:10px" href="${landing}" target="_blank" rel="noopener">${landing} ↗</a>
        ${r.approved_at ? `<span class="muted" style="margin-left:10px;font-size:12px">${fmt(r.approved_at)}</span>` : ""}
      </td></tr>`;
    }
    if (!r.id) return "";
    const code = suggestCode(r.handle ?? "");
    const displayName = r.handle || (r.email ?? "").split("@")[0] || "";
    return `<tr class="approve-row"><td colspan="5" style="padding:10px 14px;background:var(--surface-2);border-top:1px solid var(--line)">
      <form method="POST" action="/api/affiliate/approve" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">
        <input type="hidden" name="inquiry_id" value="${esc(r.id)}"/>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          App
          <select name="app" required style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px">
            <option value="" disabled selected>— wählen —</option>
            ${wiredApps}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:11px;color:var(--fg-3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">
          Code
          <input type="text" name="code" required pattern="[A-Z0-9_.\\-]{3,32}" maxlength="32" value="${esc(code)}" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;font-family:ui-monospace,monospace;width:120px;text-transform:uppercase"/>
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
          Commission
          <input type="number" name="commission_pct" min="0.01" max="1" step="0.01" value="0.5" style="margin-top:3px;padding:6px 8px;background:var(--surface);border:1px solid var(--line);border-radius:6px;color:var(--fg);font-size:13px;width:80px"/>
        </label>
        <button type="submit" class="btn" style="padding:8px 16px;font-size:13px">Approve →</button>
      </form>
    </td></tr>`;
  };

  const body = rows.length
    ? rows
        .map((r) => {
          const isApproved = r.status === "approved";
          const statusPill = isApproved
            ? `<span class="pill" style="background:var(--ok-soft,#dcfce7);color:#166534;border:1px solid #bbf7d0;font-weight:600">approved</span>`
            : `<span class="pill ${r.status === "new" ? "live" : ""}">${esc(r.status ?? "")}</span>`;
          return `<tr>
        <td class="muted" style="white-space:nowrap">${fmt(r.created_at)}</td>
        <td><span class="pill ${r.status === "new" && r.type === "affiliate" ? "live" : ""}">${esc(r.type)}</span></td>
        <td><a class="applink" href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
        <td class="muted" style="font-size:12px;max-width:520px">${esc(detail(r))}</td>
        <td>${statusPill}</td>
      </tr>${approveForm(r)}`;
        })
        .join("")
    : `<tr><td colspan="5" class="muted">noch keine Anfragen</td></tr>`;

  return `<h1>Inbox</h1><p class="sub">Affiliate- und Consulting-Anfragen von getklar.org. Affiliate-Zeilen ohne Approve haben darunter ein Formular: App wählen, Code akzeptieren oder ändern, Approve klicken — mintet den Code in der App-Supabase und markiert die Anfrage als <em>approved</em>.</p>
    ${cards}
    <table><thead><tr><th>Wann</th><th>Typ</th><th>Email</th><th>Details</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
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
  if (!KLAR_ADMIN_KEY) return doc(`<p style="color:#FF6B6B;padding:24px;font-family:'JetBrains Mono',monospace">Server misconfigured: KLAR_ADMIN_KEY not set.</p>`);
  const url = new URL(req.url);
  const qKey = url.searchParams.get("key") ?? "";
  const byQuery = !!qKey && ctEqual(qKey, KLAR_ADMIN_KEY);
  const authed = byQuery || ctEqual(readCookie(req, "klar_admin"), KLAR_ADMIN_KEY);
  if (!authed) return qKey ? loginPage("Wrong key.") : loginPage();

  const apps = getApps();
  const flash = url.searchParams.get("msg");
  const view = url.searchParams.get("view") || "overview";

  let main: string;
  if (view === "outreach") main = await outreachView();
  else if (view === "inbox") main = await inboxView();
  else if (view === "bookings") main = await bookingsView();
  else if (view === "cal") main = calView();
  else if (view === "revenue") main = await revenueView(apps);
  else if (view === "payouts") main = await payoutsView(apps);
  else {
    const app = apps.find((a) => a.slug === view);
    main = app ? await appView(app) : await overview(apps);
  }

  const res = doc(shell(view, apps, flash, main));
  if (byQuery) {
    res.headers.append(
      "Set-Cookie",
      `klar_admin=${encodeURIComponent(qKey)}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=43200`,
    );
  }
  return res;
}
