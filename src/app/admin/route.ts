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
}

function ctEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}
function readCookie(req: Request, name: string): string {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const eur = (c: number | null | undefined) =>
  (Number(c ?? 0) / 100).toLocaleString("de-CH", { style: "currency", currency: "EUR" });

const STYLE = `
:root{
 --bg:oklch(0.045 0.004 270);--bg-2:oklch(0.082 0.004 270);--bg-3:oklch(0.12 0.004 270);
 --fg:oklch(0.97 0.002 270);--fg-2:oklch(0.79 0.002 270);--fg-3:oklch(0.58 0.002 270);--fg-4:oklch(0.42 0.002 270);
 --line:oklch(0.20 0.003 270);--line-2:oklch(0.30 0.003 270);--line-strong:oklch(0.86 0.002 270);
 --accent:oklch(0.72 0.20 348);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit;text-decoration:none}
::selection{background:var(--accent);color:var(--bg)}
.layout{display:flex;min-height:100vh}
.side{width:248px;flex-shrink:0;border-right:1px solid var(--line);padding:28px 18px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:3px;overflow-y:auto}
.brand{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:25px;letter-spacing:-0.03em;padding:0 8px;display:flex;align-items:baseline;gap:7px}
.brand .dot{color:var(--accent)}
.brand small{font-family:'Inter',sans-serif;color:var(--fg-3);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.2em}
.navsec{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;color:var(--fg-4);padding:0 11px;margin:22px 0 7px}
.nav{display:flex;align-items:center;gap:9px;padding:9px 11px;color:var(--fg-3);font-size:13.5px;font-weight:500;border-radius:7px;transition:color .15s,background .15s}
.nav:hover{color:var(--fg);background:var(--bg-2)}
.nav.on{color:var(--fg);background:var(--bg-2);font-weight:600;box-shadow:inset 2px 0 0 var(--accent)}
.nav .d{font-size:8px;color:var(--fg-4)}
.nav.on .d{color:var(--accent)}
.spacer{flex:1;min-height:18px}
.logout{color:var(--fg-4);font-size:12.5px}
.logout:hover{color:var(--fg)}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;gap:8px;padding:16px 44px;border-bottom:1px solid var(--line);font-size:12px;color:var(--fg-3);position:sticky;top:0;background:oklch(0.045 0.004 270 / 0.86);backdrop-filter:blur(8px);z-index:5}
.crumb{color:var(--fg-4)}
.crumb b{color:var(--fg-2);font-weight:600}
.content{padding:40px 44px;max-width:1140px;width:100%}
h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:33px;letter-spacing:-0.025em;line-height:1.08;margin:0 0 10px}
.sub{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:19px;line-height:1.45;color:var(--fg-2);margin:0 0 30px;max-width:62ch}
h2{font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--fg-3);margin:38px 0 14px}
.flash{border:1px solid var(--line-2);border-left:2px solid var(--accent);padding:13px 16px;margin-bottom:24px;font-size:13.5px;background:var(--bg-2);border-radius:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:9px;overflow:hidden;margin-bottom:30px}
.card{padding:20px 22px;background:var(--bg)}
.k{color:var(--fg-3);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.13em}
.v{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;margin-top:9px;line-height:1;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.s{color:var(--fg-3);font-size:12.5px;margin-top:6px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{font-size:10.5px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:var(--fg-3);text-align:left;border-bottom:1px solid var(--line-strong);padding:10px 10px}
td{padding:11px 10px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
tr:hover td{background:var(--bg-2)}
.r{text-align:right}.c{text-align:center}
.pill{display:inline-block;padding:3px 10px;font-size:10.5px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;border:1px solid var(--line-2);border-radius:999px;color:var(--fg-3)}
.pill.live{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.btn{display:inline-block;padding:11px 20px;border:1px solid var(--fg);background:var(--fg);color:var(--bg);font-size:12.5px;font-weight:600;letter-spacing:0.03em;border-radius:7px;cursor:pointer;transition:opacity .15s}
.btn:hover{opacity:.82}
.btn.ghost{background:transparent;color:var(--fg);border-color:var(--line-2)}
.btn.ghost:hover{background:var(--bg-2);opacity:1}
.batch{border:1px solid var(--line-2);border-radius:8px;padding:16px 18px;margin-top:14px;background:var(--bg-2)}
.muted{color:var(--fg-3)}
.warn{color:var(--bg);background:var(--accent);padding:2px 7px;border-radius:5px;font-size:10.5px;font-weight:600}
.applink{font-weight:600;border-bottom:1px solid var(--line-2);padding-bottom:1px}
.applink:hover{border-color:var(--accent)}
.chart{border:1px solid var(--line-2);background:var(--bg-2);padding:20px;border-radius:9px}
.legend{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.09em;color:var(--fg-3);margin-top:12px;display:flex;gap:20px;flex-wrap:wrap}
.legend i{display:inline-block;width:11px;height:11px;margin-right:6px;vertical-align:-1px;border-radius:2px}
.iframewrap{border:1px solid var(--line-2);background:#fff;border-radius:8px;overflow:hidden}
iframe{width:100%;height:74vh;border:0;display:block}
::-webkit-scrollbar{width:7px;height:7px}::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:4px}
@view-transition{navigation:auto}
::view-transition-old(root),::view-transition-new(root){animation-duration:130ms}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--accent)}
.login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden}
.login::before{content:"";position:absolute;top:50%;left:50%;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,oklch(0.72 0.20 348 / 0.16),transparent 62%);filter:blur(38px);transform:translate(-50%,-56%);pointer-events:none;z-index:0}
.login-card{position:relative;z-index:1;width:100%;max-width:392px;text-align:center;border:1px solid var(--line-2);background:var(--bg-2);border-radius:16px;padding:42px 38px;box-shadow:0 26px 64px -30px rgba(0,0,0,0.72)}
.login-badge{display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0 auto 16px;border:1px solid var(--line-2);border-radius:12px;background:var(--bg);color:var(--accent)}
.login-mark{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:44px;letter-spacing:-0.03em;line-height:1}
.login-tag{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:18px;color:var(--fg-2);margin:10px 0 0}
.login-rule{height:1px;background:var(--line);margin:24px 0 22px}
.login-err{color:var(--accent);font-size:12.5px;font-weight:600;letter-spacing:.03em;margin:0 0 14px}
.login-input{width:100%;padding:14px 16px;border:1px solid var(--line-2);background:var(--bg);color:var(--fg);font-size:15px;font-family:'Inter',sans-serif;border-radius:9px;transition:border-color .15s}
.login-foot{color:var(--fg-4);font-size:11px;letter-spacing:.07em;text-transform:uppercase;margin-top:24px}
@media(prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation:none}}
@media(max-width:820px){
 .layout{flex-direction:column}
 .side{width:auto;height:auto;position:static;flex-direction:row;flex-wrap:wrap;align-items:center;gap:5px;border-right:0;border-bottom:1px solid var(--line);padding:14px 16px}
 .brand{width:100%;margin-bottom:4px}
 .navsec{display:none}.spacer{display:none}
 .topbar{padding:13px 20px}.content{padding:24px 20px}
}
`;

function doc(inner: string): Response {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Klar Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<script type="speculationrules">{"prerender":[{"where":{"and":[{"href_matches":"/admin*"},{"not":{"href_matches":"/admin/logout*"}}]},"eagerness":"moderate"}]}</script>
<style>${STYLE}</style></head><body>${inner}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function loginPage(err?: string): Response {
  return doc(`<div class="login">
    <div class="login-card">
      <div class="login-badge" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div class="login-mark">klar<span style="color:var(--accent)">.</span></div>
      <p class="login-tag">Das Kontrollzentrum hinter dem Studio.</p>
      <div class="login-rule"></div>
      ${err ? `<p class="login-err">${esc(err)}</p>` : ""}
      <form method="GET" action="/admin">
        <input class="login-input" name="key" type="password" placeholder="Admin-Key" autofocus autocomplete="current-password"/>
        <button class="btn" style="margin-top:12px;width:100%;padding:14px" type="submit">Anmelden</button>
      </form>
      <p class="login-foot">Intern · getklar.org</p>
    </div></div>`);
}

function shell(view: string, apps: AdminApp[], flash: string | null, main: string): string {
  const item = (v: string, label: string, dot = "○") =>
    `<a class="nav ${view === v ? "on" : ""}" href="/admin?view=${encodeURIComponent(v)}"><span class="d">${dot}</span>${esc(label)}</a>`;
  const appLinks = apps.map((a) => item(a.slug, a.name, "●")).join("");
  const labels: Record<string, string> = {
    overview: "Übersicht", inbox: "Inbox", revenue: "Einnahmen", outreach: "Outreach",
  };
  const here =
    labels[view] ?? apps.find((a) => a.slug === view)?.name ?? "Übersicht";
  return `<div class="layout">
    <aside class="side">
      <div class="brand">klar<span class="dot">.</span><small>Control</small></div>
      <div class="navsec">Studio</div>
      ${item("overview", "Übersicht")}
      ${item("inbox", "Inbox")}
      <div class="navsec">Affiliate</div>
      ${item("revenue", "Einnahmen")}
      ${appLinks || `<span class="nav muted">keine Apps</span>`}
      <div class="navsec">Extern</div>
      ${item("outreach", "Outreach")}
      <div class="spacer"></div>
      <a class="nav logout" href="/admin/logout"><span class="d">→</span>Logout</a>
    </aside>
    <main class="main">
      <div class="topbar"><span class="crumb">Klar Control&nbsp; ·&nbsp; <b>${esc(here)}</b></span></div>
      <div class="content">
        ${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
        ${main}
      </div>
    </main></div>`;
}

// Server-rendered SVG grouped bar chart. series: [{label, gross, payout}] in cents.
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
    return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="oklch(0.18 0.002 270)" stroke-width="1"/>
      <text x="${padL - 8}" y="${yy + 3}" text-anchor="end" font-family="'Inter',sans-serif" font-size="9" fill="oklch(0.48 0.002 270)">${(val / 100).toFixed(0)}</text>`;
  }).join("");
  const bars = series.map((d, i) => {
    const x0 = padL + i * cw;
    const bw = Math.max(6, cw * 0.28);
    const gx = x0 + cw / 2 - bw - 3, px = x0 + cw / 2 + 3;
    const gy = y(Math.max(0, d.gross)), py = y(Math.max(0, d.payout));
    const base = y(0);
    return `<rect x="${gx}" y="${gy}" width="${bw}" height="${Math.max(0, base - gy)}" fill="oklch(0.97 0.002 270)"/>
      <rect x="${px}" y="${py}" width="${bw}" height="${Math.max(0, base - py)}" fill="oklch(0.48 0.002 270)"/>
      <text x="${x0 + cw / 2}" y="${H - padB + 16}" text-anchor="middle" font-family="'Inter',sans-serif" font-size="9" fill="oklch(0.48 0.002 270)">${esc(d.label)}</text>`;
  }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Einnahmen pro Monat">
    ${gridLines}<line x1="${padL}" y1="${y(0)}" x2="${W - padR}" y2="${y(0)}" stroke="oklch(0.85 0.002 270)" stroke-width="1"/>${bars}</svg>
    <div class="legend"><span><i style="background:oklch(0.97 0.002 270)"></i>Affiliate-Umsatz</span><span><i style="background:oklch(0.48 0.002 270)"></i>Auszahlung an Affiliates</span><span>EUR pro Monat</span></div></div>`;
}

async function overview(apps: AdminApp[]): Promise<string> {
  if (apps.length === 0)
    return `<h1>Übersicht</h1><p class="sub">Noch keine Apps verbunden. Sobald KLAR_ADMIN_APPS im klar-Vercel-Projekt gesetzt ist, tauchen sie hier auf.</p>`;
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
    <div class="card"><div class="k">Apps verbunden</div><div class="v">${rows.length}</div><div class="s">${rows.filter(r=>r.onboarded).length} mit Daten</div></div>
    <div class="card"><div class="k">Affiliates gesamt</div><div class="v">${totalAff}</div></div>
    <div class="card"><div class="k">Offen gesamt</div><div class="v">${eur(totalOpen)}</div><div class="s">netto, gereift</div></div>
  </div>`;
  const tbl = `<table><thead><tr><th>App</th><th class="r">Affiliates</th><th class="r">Aktiv</th><th class="r">Offen (EUR)</th><th class="c">FX</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr>
      <td><a class="applink" href="/admin?view=${esc(r.app.slug)}">${esc(r.app.name)}</a> ${r.onboarded ? "" : `<span class="pill">nicht ausgerollt</span>`}</td>
      <td class="r">${r.total}</td><td class="r">${r.active}</td>
      <td class="r">${eur(r.open)}</td>
      <td class="c">${r.fx > 0 ? `<span class="warn">${r.fx}</span>` : "ok"}</td>
      <td class="r"><a class="pill" href="/admin?view=${esc(r.app.slug)}">öffnen</a></td>
    </tr>`).join("")}
  </tbody></table>`;
  return `<h1>Übersicht</h1><p class="sub">Alle verbundenen Apps auf einen Blick. Wähl eine App für Salden, Details und Auszahlungen.</p>${cards}${tbl}`;
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

  const body = rows.length
    ? rows
        .map(
          (r) => `<tr>
        <td class="muted" style="white-space:nowrap">${fmt(r.created_at)}</td>
        <td><span class="pill ${r.status === "new" ? "live" : ""}">${esc(r.type)}</span></td>
        <td><a class="applink" href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
        <td class="muted" style="font-size:12px;max-width:520px">${esc(detail(r))}</td>
        <td>${esc(r.status)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted">noch keine Anfragen</td></tr>`;

  return `<h1>Inbox</h1><p class="sub">Affiliate- und Consulting-Anfragen von getklar.org. Dauerhaft in Supabase gespeichert, neueste zuerst. Klick eine Email zum direkten Antworten.</p>
    ${cards}
    <table><thead><tr><th>Wann</th><th>Typ</th><th>Email</th><th>Details</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
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
  else if (view === "revenue") main = await revenueView(apps);
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
