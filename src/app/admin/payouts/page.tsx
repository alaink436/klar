// Klar Control · Auszahlungen (payouts) view.
//
// Server component. Aggregates affiliate payout batches across every wired-up
// app (influencer_payout_batches + influencer_claimable per app's Supabase),
// renders KPI cards + an "alle vorbereiten" form + open/dispatched/history
// tables. The per-row Wise-prepare / reconcile forms POST to the existing
// /admin/dispatch · /admin/dispatch-all · /admin/reconcile handlers (unchanged).
// Same STYLE/ICON chrome + 2FA gate as the rest of /admin; ?msg= flash from
// dispatch-all is rendered at the top, identical to the old shell().
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
  esc,
  eur,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, sbGet, type AdminApp } from "../../../lib/adminApps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

async function payoutsMain(apps: AdminApp[]): Promise<string> {
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

export default async function PayoutsPage({
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
  const main = await payoutsMain(apps);
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const sidebar = adminSidebar("payouts", apps);
  const topbar = `
    <span class="crumb"><b>Auszahlungen</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Auszahlungen · Klar Control</title>
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
