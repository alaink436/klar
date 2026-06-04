// Klar Control · Übersicht (overview) — the default landing view.
//
// Server component. Aggregates affiliate revenue, outreach funnel and inbox
// activity across all wired-up apps, then renders the app-tab strip, an
// attention strip, KPI cards, a server-rendered SVG bar chart, funnel +
// activity cards and a per-app table. Same STYLE/ICON chrome and 2FA gate as
// the rest of /admin. Inner content is built as an HTML string (reusing the
// shared barChart/eur/esc/fmtRelative helpers) and injected, so output stays
// byte-identical to the old route.ts overview(). Bare /admin and ?view=overview
// 303-redirect here.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET (+ per-app Supabase
//      keys via sbGet, and KLAR_INBOX_* for the activity feed).

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
  adminSidebar,
  esc,
  eur,
  barChart,
  fmtRelative,
  REPORTING_CURRENCY,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, sbGet, type AdminApp } from "../../../lib/adminApps";
import { listOutreachTargets, type OutreachTarget } from "../../../lib/outreachStore";
import { KLAR_APPS, type KlarAppMeta } from "../../../lib/klarApps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contact-form inbox source (anime-vault) for the overview activity feed.
const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

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

async function overviewMain(apps: AdminApp[]): Promise<string> {
  const connected = new Set(apps.map((a) => a.slug));
  const tabs = appTabStrip(connected);

  if (apps.length === 0) {
    return `<h1>Übersicht</h1><p class="sub">Alle Klar-Apps auf einen Blick. Klick eine verdrahtete App fürs Affiliate-Detail; die anderen tauchen auf, sobald sie ein Schema in <code>KLAR_ADMIN_APPS</code> bekommen.</p>${tabs}`;
  }

  // Monats-Aggregat (über alle Apps) für Umsatz-Chart + MoM-Delta, plus eine
  // deduplizierte Target-Liste für den Activity-Feed (ein Target kann via
  // for_apps[] in mehreren App-Fetches auftauchen).
  const monthly = new Map<string, { gross: number; payout: number }>();
  const targetSeen = new Set<string>();
  const allTargets: OutreachTarget[] = [];

  const rows = await Promise.all(apps.map(async (app) => {
    const [inf, claim, outreach, events] = await Promise.all([
      sbGet(app, "influencers?select=status"),
      sbGet(app, "influencer_claimable?select=claimable_eur_cents,unnormalized_events"),
      listOutreachTargets({ platform: "all", status: "all", app: app.slug, limit: 500 }),
      sbGet(app, "referral_revenue_events?select=event_at,gross_revenue_cents,share_cents_eur&order=event_at&limit=4000"),
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
      if (t.id && !targetSeen.has(t.id)) { targetSeen.add(t.id); allTargets.push(t); }
    }
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
    return { app, onboarded, total: inf.length, active, open, fx, angefragt, reply, angenommen, gross, payout };
  }));

  // Inbox-Anfragen einmal laden: neue-Anzahl (Aktions-Strip) + jüngste fürs
  // Activity-Feed. Best-effort, ohne Key/Fehler bleibt der Feed schlanker.
  let inquiriesNew = 0;
  let recentInquiries: any[] = [];
  if (KLAR_INBOX_KEY) {
    try {
      const res = await fetch(
        `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?select=email,type,status,created_at,handle&order=created_at.desc&limit=50`,
        { headers: { apikey: KLAR_INBOX_KEY, Authorization: `Bearer ${KLAR_INBOX_KEY}`, Accept: "application/json" }, cache: "no-store" },
      );
      if (res.ok) {
        const j = await res.json();
        recentInquiries = Array.isArray(j) ? j : [];
        inquiriesNew = recentInquiries.filter((r) => r.status === "new").length;
      }
    } catch {
      /* Feed bleibt ohne Inbox-Items */
    }
  }
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const totalAff = rows.reduce((s, r) => s + r.total, 0);
  const totalActive = rows.reduce((s, r) => s + r.active, 0);
  const totalAngefragt = rows.reduce((s, r) => s + r.angefragt, 0);
  const totalReply = rows.reduce((s, r) => s + r.reply, 0);
  const totalAngenommen = rows.reduce((s, r) => s + r.angenommen, 0);

  // Monats-Serie (letzte 12) + Monat-über-Monat-Vergleich für die Delta-Tags.
  const series = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
    .map(([k, v]) => { const [yy, mm] = k.split("-"); return { label: `${mm}/${yy.slice(2)}`, gross: v.gross, payout: v.payout }; });
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYm = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, "0")}`;
  const thisM = monthly.get(thisYm) ?? { gross: 0, payout: 0 };
  const lastM = monthly.get(lastYm) ?? { gross: 0, payout: 0 };
  // Schlanke Inline-SVG-Glyphen (currentColor, 2px stroke) statt Emoji — die
  // Emoji waren der größte "AI-generiert"-Tell. Stil = wie der Login-Chevron.
  const gi = (inner: string, size = 14): string =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${inner}</svg>`;
  const G = {
    up: `<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>`,
    down: `<path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/>`,
    send: `<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>`,
    reply: `<path d="M9 17l-5-5 5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v1"/>`,
    check: `<path d="M20 6 9 17l-5-5"/>`,
    inbox: `<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>`,
    doc: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>`,
  };
  const deltaTag = (cur: number, prev: number): string => {
    if (prev === 0 && cur === 0) return `<span class="muted">keine Vormonatsdaten</span>`;
    if (prev === 0) return `<span style="display:inline-flex;align-items:center;gap:4px;color:var(--success);font-weight:600">${gi(G.up, 13)} neu</span>`;
    const pct = ((cur - prev) / prev) * 100;
    const up = pct >= 0;
    return `<span style="display:inline-flex;align-items:center;gap:4px;color:${up ? "var(--success)" : "var(--danger)"};font-weight:600;font-variant-numeric:tabular-nums">${gi(up ? G.up : G.down, 13)} ${Math.abs(pct).toFixed(0)}%<span class="muted" style="font-weight:400;margin-left:3px">vs. Vormonat</span></span>`;
  };

  // Aktions-Strip: neutrale Chips (Surface + Hairline), Akzent nur auf Icon +
  // Zahl. Nur was offen ist, jeweils mit Direkt-Link.
  const attn = (n: number, label: string, href: string, glyph: string, accent: string): string =>
    n > 0 ? `<a href="${href}" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius-sm);padding:8px 13px;font-size:12.5px;color:var(--fg)"><span style="display:inline-flex;color:${accent}">${gi(glyph, 15)}</span><span style="font-weight:600">${esc(label)}</span><span style="font-family:var(--font-mono);font-weight:700;color:${accent}">${n}</span></a>` : "";
  const attnItems = [
    attn(totalReply, "Offene Antworten", "/admin/replies", G.reply, "var(--warning)"),
    attn(inquiriesNew, "Neue Anfragen", "/admin?view=inbox", G.inbox, "var(--info)"),
    attn(totalAngefragt, "Wartet auf Antwort", "/admin?view=outreach", G.send, "var(--fg-3)"),
  ].filter(Boolean).join("");
  const attnStrip = attnItems
    ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 20px"><span class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.14em;font-family:var(--font-mono);margin-right:4px">Braucht Aufmerksamkeit</span>${attnItems}</div>`
    : `<div class="muted" style="display:flex;align-items:center;gap:8px;margin:0 0 20px;font-size:13px">${gi(G.check, 15)} Nichts Offenes, alle Antworten und Anfragen sind abgearbeitet.</div>`;

  // KPI-Grid: Umsatz/Auszahlung mit MoM-Delta, Offen, Affiliates.
  const cards = `<div class="cards">
    <div class="card"><div class="k">Affiliate-Umsatz (Monat)</div><div class="v">${eur(thisM.gross)}</div><div class="s">${deltaTag(thisM.gross, lastM.gross)}</div></div>
    <div class="card"><div class="k">Auszahlung (Monat)</div><div class="v">${eur(thisM.payout)}</div><div class="s">${deltaTag(thisM.payout, lastM.payout)}</div></div>
    <div class="card"><div class="k">Offen gesamt</div><div class="v">${eur(totalOpen)}</div><div class="s">netto, gereift</div></div>
    <div class="card"><div class="k">Affiliates</div><div class="v">${totalAff}</div><div class="s">${totalActive} aktiv · ${rows.filter(r=>r.onboarded).length}/${KLAR_APPS.length} Apps verdrahtet</div></div>
  </div>`;

  // Funnel-Card: dünne, scharfkantige Balken (kein candy-radius), monochrome
  // Verjüngung, nur "Angenommen" im Success-Grün als Endstufe.
  const funnelMax = Math.max(1, totalAngefragt, totalReply, totalAngenommen);
  const frow = (glyph: string, label: string, n: number, color: string): string =>
    `<div style="display:flex;align-items:center;gap:11px;margin:9px 0">
      <span style="display:inline-flex;color:var(--fg-3)">${gi(glyph, 15)}</span>
      <span style="min-width:104px;font-size:12.5px;color:var(--fg-2)">${esc(label)}</span>
      <div style="flex:1;background:var(--surface-2);height:10px;overflow:hidden"><div style="width:${Math.min(100, (n / funnelMax) * 100).toFixed(1)}%;height:100%;background:${color}"></div></div>
      <span style="min-width:32px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:700;font-variant-numeric:tabular-nums">${n}</span>
    </div>`;
  const funnelCard = `<div class="card" style="padding:20px 22px;display:block">
    <div class="k" style="margin-bottom:14px">Outreach-Funnel · alle Apps</div>
    ${frow(G.send, "Angefragt", totalAngefragt, "var(--fg)")}
    ${frow(G.reply, "Antwort", totalReply, "color-mix(in oklab,var(--fg) 50%,var(--surface-2))")}
    ${frow(G.check, "Angenommen", totalAngenommen, "var(--success)")}
  </div>`;

  // Activity-Feed: jüngste Replies + Conversions + neue Anfragen, gemischt.
  // efferd-Muster: Hairline-Divider, Icon im quadratischen Rahmen, Titel + Zeit.
  const acts: Array<{ t: number; glyph: string; accent: string; text: string; href: string }> = [];
  for (const t of allTargets) {
    const who = t.display_name || t.handle;
    if (t.status === "replied" && t.last_message_at) acts.push({ t: Date.parse(t.last_message_at), glyph: G.reply, accent: "var(--warning)", text: `${who} hat geantwortet`, href: "/admin?view=outreach" });
    if (t.status === "converted" && t.converted_at) acts.push({ t: Date.parse(t.converted_at), glyph: G.check, accent: "var(--success)", text: `${who} als Affiliate angenommen`, href: "/admin?view=outreach" });
  }
  for (const r of recentInquiries) {
    if (r.created_at) acts.push({ t: Date.parse(String(r.created_at)), glyph: r.type === "affiliate" ? G.inbox : G.doc, accent: "var(--info)", text: `Neue ${r.type === "affiliate" ? "Affiliate" : "Consulting"}-Anfrage: ${r.handle || r.email || "?"}`, href: "/admin?view=inbox" });
  }
  const actsSorted = acts.filter((a) => !isNaN(a.t)).sort((a, b) => b.t - a.t).slice(0, 7);
  const actRow = (a: { glyph: string; accent: string; text: string; href: string; t: number }): string =>
    `<a href="${a.href}" style="display:flex;align-items:center;gap:12px;height:54px;text-decoration:none;border-top:1px solid var(--line)">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--line);color:${a.accent};flex-shrink:0">${gi(a.glyph, 15)}</span>
      <span style="flex:1;min-width:0;font-size:13px;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.text)}</span>
      <span class="muted" style="font-size:11px;font-family:var(--font-mono);white-space:nowrap">${esc(fmtRelative(new Date(a.t).toISOString()))}</span>
    </a>`;
  const activityCard = `<div class="card" style="padding:20px 22px 8px;display:block">
    <div class="k" style="margin-bottom:8px">Letzte Aktivität</div>
    ${actsSorted.length ? actsSorted.map(actRow).join("") : `<span class="muted" style="font-size:13px;display:block;padding:14px 0">Noch keine Replies, Conversions oder Anfragen.</span>`}
  </div>`;

  // Tabellen-Counts: schlichte Mono-Zahlen mit dezentem Akzent (kein Pastell-
  // Pill-Regenbogen), 0 gedämpft.
  const cnt = (n: number, accent: string): string => n === 0
    ? `<span class="muted" style="font-variant-numeric:tabular-nums">0</span>`
    : `<span style="font-family:var(--font-mono);font-weight:700;color:${accent};font-variant-numeric:tabular-nums">${n}</span>`;
  const tbl = `<table><thead><tr><th>App</th><th class="r">Affiliates</th><th class="r">Aktiv</th><th class="c">Angefragt</th><th class="c">Antwort</th><th class="c">Angenommen</th><th class="r">Offen (${esc(REPORTING_CURRENCY)})</th><th></th></tr></thead><tbody>
    ${rows.map((r) => `<tr>
      <td><a class="applink" href="/admin?view=${esc(r.app.slug)}">${esc(r.app.name)}</a> ${r.onboarded ? "" : `<span class="pill">nicht ausgerollt</span>`}</td>
      <td class="r">${r.total}</td><td class="r">${r.active}</td>
      <td class="c">${cnt(r.angefragt, "var(--fg-2)")}</td>
      <td class="c">${cnt(r.reply, "var(--warning)")}</td>
      <td class="c">${cnt(r.angenommen, "var(--success)")}</td>
      <td class="r">${eur(r.open)}</td>
      <td class="r"><a class="applink" href="/admin?view=${esc(r.app.slug)}" style="font-size:12px">öffnen →</a></td>
    </tr>`).join("")}
  </tbody></table>`;
  return `<h1>Übersicht</h1><p class="sub">Alle Klar-Apps auf einen Blick: Affiliate-Umsatz, Outreach-Funnel und was gerade Aufmerksamkeit braucht.</p>
    ${tabs}
    ${attnStrip}
    ${cards}
    <h2>Affiliate-Umsatz pro Monat</h2>${barChart(series)}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin:14px 0 8px">${funnelCard}${activityCard}</div>
    <h2>Affiliate-Stand · Outreach-Funnel pro App</h2>${tbl}`;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
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
  const apps = getApps();
  const main = await overviewMain(apps);
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const sidebar = adminSidebar("overview", apps);
  const topbar = `
    <span class="crumb"><b>Übersicht</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Übersicht · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content" dangerouslySetInnerHTML={{ __html: flash + main }} />
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
