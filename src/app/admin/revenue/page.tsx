// Klar Control · Einnahmen (revenue) view.
//
// Server component. Aggregates affiliate-attributed revenue per app and month
// from each app's Supabase (referral_revenue_events + influencer_claimable),
// renders summary cards + a server-rendered SVG bar chart + a per-app table.
// Same STYLE/ICON chrome and 2FA gate as the rest of /admin. The inner content
// is built as an HTML string (reusing the shared eur/barChart helpers) and
// injected, so output stays byte-identical to the old route.ts revenueView.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET (+ per-app Supabase
//      keys consumed by sbGet via the app registry).

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
  eur,
  REPORTING_CURRENCY,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, sbGet, type AdminApp } from "../../../lib/adminApps";
import RevenueAffiliateTable, { type RevenueRow } from "./RevenueAffiliateTable";
import MonthlyBarChart from "../MonthlyBarChart";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function revenueMain(apps: AdminApp[]): Promise<{
  htmlTop: string;
  series: { label: string; gross: number; payout: number }[];
  htmlMid: string;
  tableRows: RevenueRow[];
}> {
  if (apps.length === 0)
    return {
      htmlTop: `<h1>Einnahmen</h1><p class="sub">Noch keine Apps konfiguriert, darum gibt es hier nichts zu zeigen.</p>`,
      series: [],
      htmlMid: "",
      tableRows: [],
    };
  const monthly = new Map<string, { gross: number; payout: number }>();
  let totalGross = 0, totalPayout = 0, totalOpen = 0, totalAff = 0;

  const perApp = await Promise.all(apps.map(async (app) => {
    const [inf, claim, events] = await Promise.all([
      sbGet(app, "influencers?select=status", { revalidate: 30 }),
      sbGet(app, "influencer_claimable?select=claimable_eur_cents", { revalidate: 30 }),
      sbGet(app, "referral_revenue_events?select=event_at,gross_revenue_cents,share_cents_eur&order=event_at&limit=4000", { revalidate: 30 }),
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

  const tableRows: RevenueRow[] = perApp.map((r) => ({
    slug: r.app.slug,
    name: r.app.name,
    affiliates: r.affiliates,
    grossCents: r.gross,
    grossFmt: eur(r.gross),
    payoutCents: r.payout,
    payoutFmt: eur(r.payout),
    openCents: r.open,
    openFmt: eur(r.open),
  }));

  const htmlTop = `<h1>Einnahmen</h1><p class="sub">Affiliate-attribuierter Umsatz pro App und Monat. Nicht der gesamte App-Umsatz, der bräuchte RevenueCat- und Store-Daten als separate Integration.</p>
    ${cards}<h2>Pro Monat</h2>`;
  const htmlMid = `<h2>Pro App</h2>`;
  return { htmlTop, series, htmlMid, tableRows };
}

export default async function RevenuePage() {
  // Auth — identical gate to brain/cal/bookings (device cookie + admin session).
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) redirect("/admin/login");
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const device = await verifyDeviceCookie(readCookieFromString(cookieHeader, "klar_device"), DEV);
  if (!device) redirect("/admin/login");
  if (readCookieFromString(cookieHeader, "klar_admin") !== KEY) redirect("/admin/login");

  const apps = getApps();
  const { htmlTop, series, htmlMid, tableRows } = await revenueMain(apps);
  const sidebar = adminSidebar("revenue", apps);
  const topbar = `
    <span class="crumb"><b>Einnahmen</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Einnahmen · Klar Control</title>
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
          <div className="content">
            <div dangerouslySetInnerHTML={{ __html: htmlTop }} />
            {series.length ? <MonthlyBarChart series={series} currency={REPORTING_CURRENCY} /> : null}
            <div dangerouslySetInnerHTML={{ __html: htmlMid }} />
            {tableRows.length ? <RevenueAffiliateTable rows={tableRows} /> : null}
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
