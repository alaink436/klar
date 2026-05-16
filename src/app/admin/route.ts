// Central Klar payout control-plane. Server-rendered, no client JS, all
// secrets server-side. Gated by KLAR_ADMIN_KEY (query ?key= once -> cookie).
// Views via ?view= : overview (default) | <app-slug> | outreach
//
// Styling mirrors the klar design system (globals.css tokens + Anton/Eczar/
// Manrope/JetBrains Mono, brutalist, monochrome). A route handler does not
// inherit the app's bundled CSS, so the tokens + fonts are ported faithfully.
//
// Env: KLAR_ADMIN_KEY, KLAR_ADMIN_APPS (JSON registry, see lib/adminApps),
//      KLAR_OUTREACH_SHEET_ID (optional, defaults to the Marketing master).

import { getApps, sbGet, type AdminApp } from "../../lib/adminApps";

export const dynamic = "force-dynamic";

const KLAR_ADMIN_KEY = process.env.KLAR_ADMIN_KEY ?? "";
const OUTREACH_SHEET_ID =
  process.env.KLAR_OUTREACH_SHEET_ID ?? "16MLUtfYVDzbu3bxjntilRqD_XjHSaRmypwpj1Rarx0c";

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
:root{--bg:oklch(0.04 0.002 270);--bg-2:oklch(0.08 0.002 270);--fg:oklch(0.97 0.002 270);--fg-2:oklch(0.74 0.002 270);--fg-3:oklch(0.48 0.002 270);--fg-4:oklch(0.32 0.002 270);--line:oklch(0.18 0.002 270);--line-strong:oklch(0.85 0.002 270)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:'Manrope',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.layout{display:flex;min-height:100vh}
.side{width:232px;flex-shrink:0;border-right:1px solid var(--line-strong);padding:26px 14px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:2px}
.brand{font-family:'Anton',sans-serif;font-size:28px;letter-spacing:-0.02em;padding:0 10px}
.brand small{display:block;font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--fg-3);font-size:10px;text-transform:uppercase;letter-spacing:0.2em;margin:8px 0 20px}
.nav{display:block;padding:10px 11px;color:var(--fg-3);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;border:1px solid transparent}
.nav:hover{color:var(--fg);border-color:var(--line)}
.nav.on{background:var(--fg);color:var(--bg);font-weight:600}
.nav .d{margin-right:8px;opacity:0.7}
.spacer{flex:1}
.main{flex:1;padding:36px 42px;max-width:1120px}
h1{font-family:'Anton',sans-serif;font-weight:400;font-size:44px;letter-spacing:-0.02em;line-height:0.95;margin:0 0 8px}
h2{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--fg-3);margin:30px 0 0;font-weight:400}
.sub{font-family:'Eczar',serif;font-style:italic;color:var(--fg-3);font-size:17px;margin:0 0 26px}
.flash{border:1px solid var(--line-strong);padding:12px 16px;margin-bottom:22px;font-size:13px;background:var(--bg-2)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));border:1px solid var(--line-strong);margin-bottom:28px}
.card{padding:18px 20px;border-right:1px solid var(--line)}
.card:last-child{border-right:0}
.k{font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--fg-3);font-size:10px;text-transform:uppercase;letter-spacing:0.18em}
.v{font-family:'Anton',sans-serif;font-size:34px;margin-top:8px;line-height:1}
.s{color:var(--fg-3);font-size:12px;margin-top:5px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--fg-3);text-align:left;font-weight:400;border-bottom:1px solid var(--line-strong);padding:9px 8px}
td{padding:9px 8px;border-bottom:1px solid var(--line)}
.r{text-align:right}.c{text-align:center}
.pill{display:inline-block;padding:3px 9px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;border:1px solid var(--line);color:var(--fg-3)}
.pill.live{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.btn{display:inline-block;padding:11px 18px;border:1px solid var(--fg);background:var(--fg);color:var(--bg);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer}
.btn:hover{background:var(--bg);color:var(--fg)}
.btn.ghost{background:transparent;color:var(--fg);border-color:var(--line-strong)}
.btn.ghost:hover{background:var(--fg);color:var(--bg)}
.batch{border:1px solid var(--line-strong);padding:14px 16px;margin-top:14px;background:var(--bg-2)}
.muted{color:var(--fg-3)}
.warn{color:var(--bg);background:var(--fg);padding:1px 6px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px}
.applink{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid var(--fg);padding-bottom:1px}
.iframewrap{border:1px solid var(--line-strong);background:#fff}
iframe{width:100%;height:74vh;border:0;display:block}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:var(--line)}
@media(max-width:760px){.layout{flex-direction:column}.side{width:auto;height:auto;position:static;flex-direction:row;flex-wrap:wrap;border-right:0;border-bottom:1px solid var(--line-strong)}.main{padding:22px}}
`;

function doc(inner: string): Response {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Klar Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Eczar:ital,wght@1,400&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>${inner}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function loginPage(err?: string): Response {
  return doc(`<div style="max-width:360px;margin:15vh auto;text-align:center">
    <div class="brand" style="font-size:34px">klar<small>control · affiliate payouts</small></div>
    ${err ? `<p style="color:#FF6B6B;font-family:'JetBrains Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.1em">${esc(err)}</p>` : ""}
    <form method="GET" action="/admin">
      <input name="key" type="password" placeholder="KLAR_ADMIN_KEY" autofocus
        style="width:100%;padding:13px;border:1px solid var(--line);background:oklch(0.07 0 0);color:var(--fg);font-size:15px;font-family:'Manrope',sans-serif"/>
      <button class="btn" style="margin-top:12px;width:100%;padding:13px" type="submit">Enter</button>
    </form></div>`);
}

function shell(view: string, apps: AdminApp[], flash: string | null, main: string): string {
  const item = (v: string, label: string, live = false) =>
    `<a class="nav ${view === v ? "on" : ""}" href="/admin?view=${encodeURIComponent(v)}"><span class="d">${live ? "●" : "○"}</span>${esc(label)}</a>`;
  const appLinks = apps.map((a) => item(a.slug, a.name, true)).join("");
  return `<div class="layout">
    <aside class="side">
      <div class="brand">klar<small>control</small></div>
      ${item("overview", "Overview")}
      ${appLinks || `<span class="nav muted">keine apps</span>`}
      ${item("outreach", "Outreach")}
      <div class="spacer"></div>
      <a class="nav" href="/admin/logout">Logout</a>
    </aside>
    <main class="main">
      ${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
      ${main}
    </main></div>`;
}

async function overview(apps: AdminApp[]): Promise<string> {
  if (apps.length === 0)
    return `<h1>Overview</h1><p class="sub">Setze KLAR_ADMIN_APPS (JSON) im klar-Vercel-Projekt.</p>`;
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
  return `<h1>Overview</h1><p class="sub">Alle verbundenen Apps. Klick eine App für Details und Auszahlungen.</p>${cards}${tbl}`;
}

async function appView(app: AdminApp): Promise<string> {
  const [inf, claim, batches] = await Promise.all([
    sbGet(app, "influencers?select=handle,status"),
    sbGet(app, "influencer_claimable?select=handle,status,payout_method,matured_share_eur_cents,paid_eur_cents,claimable_eur_cents,unnormalized_events&order=claimable_eur_cents.desc"),
    sbGet(app, "influencer_payout_batches?select=id,period_start,period_end,status,item_count,total_amount_cents&order=created_at.desc&limit=8"),
  ]);
  if (inf.length === 0 && claim.length === 0 && batches.length === 0)
    return `<h1>${esc(app.name)}</h1><p class="sub muted">Noch nicht ausgerollt: kein Affiliate-Schema/Daten in diesem Supabase-Projekt.</p>`;
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
  return `<h1>${esc(app.name)}</h1><p class="sub">Affiliate-Saldo und Auszahlungen.</p>${cards}
    <form method="POST" action="/admin/reconcile" style="margin:0 0 18px"><input type="hidden" name="app" value="${esc(app.slug)}"/><button class="btn ghost" type="submit">Status aktualisieren · Wise nach DB</button></form>
    <table><thead><tr><th>Handle</th><th>Status</th><th>Methode</th><th class="r">Gereift</th><th class="r">Bezahlt</th><th class="r">Offen</th><th class="c">FX</th></tr></thead><tbody>${claimRows}</tbody></table>
    <h2>Batches</h2>${batchHtml || `<p class="muted" style="margin-top:12px">noch keine Batches (pg_cron baut am 1. des Monats)</p>`}`;
}

function outreachView(): string {
  const view = `https://docs.google.com/spreadsheets/d/${OUTREACH_SHEET_ID}/preview`;
  const edit = `https://docs.google.com/spreadsheets/d/${OUTREACH_SHEET_ID}/edit`;
  return `<h1>Outreach</h1><p class="sub">Influencer-Outreach-Master. Status pro App-Tab: To-Contact, Contacted, Replied, Posted.</p>
    <div style="margin-bottom:16px"><a class="btn" target="_blank" rel="noopener" href="${edit}">In Google Sheets öffnen</a></div>
    <div class="iframewrap"><iframe src="${view}" loading="lazy"></iframe></div>
    <p class="sub" style="margin-top:16px;font-size:14px">Lädt nur wenn du im selben Browser bei dem Google-Account angemeldet bist der Zugriff auf das Sheet hat. Eine automatische "X angeschrieben"-Zahl pro App braucht Google-Sheets-API-Zugang (Service-Account), separater Schritt.</p>`;
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
  if (view === "outreach") main = outreachView();
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
