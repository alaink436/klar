// Klar Control · per-app affiliate detail (formerly ?view=<slug>).
//
// Dynamic server component. Renders one app's affiliate balances, payout
// batches and influencer list (with suspend/ban/rotate/delete actions).
// Same chrome + 2FA gate as the rest of /admin, plus the
// confirm-modal infra (forms carry data-klar-confirm). Inner content is built
// as an HTML string (reusing shared esc/eur) and injected, so
// output stays byte-identical to the old route.ts appView. The POST handlers
// redirect back to /admin/<slug>?msg= (via route.ts query-forwarding) and the
// flash is rendered here.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET (+ per-app Supabase
//      keys via sbGet/listInfluencers).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  readCookieFromString,
  esc,
  eur,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApp, sbGet, setupLandingUrl, listInfluencers, type AdminApp, type InfluencerRow } from "../../../lib/adminApps";
import { getTrackingUrl, type BrandKey } from "../../affiliate/_shared/brands";

import { AdminTopbar } from "../AdminTopbar";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Quiet-Pill (mirrors route.ts): one neutral surface tone for all pills, colour
// only as restrained text tinting via tokens. Kept local to this route.
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

async function appMain(app: AdminApp): Promise<string> {
  const [inf, claim, batches] = await Promise.all([
    listInfluencers(app),
    sbGet(app, "influencer_claimable?select=handle,status,payout_method,matured_share_eur_cents,paid_eur_cents,claimable_eur_cents,unnormalized_events&order=claimable_eur_cents.desc"),
    sbGet(app, "influencer_payout_batches?select=id,period_start,period_end,status,item_count,total_amount_cents&order=created_at.desc&limit=8"),
  ]);
  if (inf.length === 0 && claim.length === 0 && batches.length === 0)
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
    const tone: PillTone =
      st === "active" ? "success"
      : st === "pending" ? "warning"
      : st === "suspended" || st === "banned" ? "danger"
      : "neutral";
    return quietPill(st, tone);
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
            ? quietPill("Token expired", "danger", "font-size:9px")
            : quietPill("invited", "info", "font-size:9px")
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

  return `<h1>${esc(app.name)}</h1>${cards}
    <form method="POST" action="/admin/reconcile" style="margin:0 0 18px"><input type="hidden" name="app" value="${esc(app.slug)}"/><button class="btn ghost" type="submit">Status aktualisieren · Wise nach DB</button></form>
    ${createAffiliateForm(app)}
    <h2>Affiliates <span class="muted" style="font-size:11px;font-weight:400;text-transform:none;letter-spacing:0">${inf.length} Einträge</span></h2>
    <table>
      <thead><tr><th>Handle</th><th>Status</th><th>Email</th><th>Auszahlung</th><th class="r">Share</th><th class="r">Aktionen</th></tr></thead>
      <tbody>${infRows}</tbody>
    </table>
    <h2>Salden + Conversions</h2>
    <table><thead><tr><th>Handle</th><th>Status</th><th>Methode</th><th class="r">Gereift</th><th class="r">Bezahlt</th><th class="r">Offen</th><th class="c">FX</th></tr></thead><tbody>${claimRows}</tbody></table>
    <h2>Batches</h2>${batchHtml || `<p class="muted">noch keine Batches (pg_cron baut am 1. des Monats)</p>`}`;
}

export default async function AppDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ app: string }>;
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

  const { app: slug } = await params;
  const appObj = getApp(slug);
  if (!appObj) redirect("/admin/overview");

  const sp = await searchParams;
  const main = await appMain(appObj);
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";

  return (
    <>
      <title>{`${appObj.name} · Klar Control`}</title>
      <AdminTopbar titel={appObj.name} />
      <div className="content" dangerouslySetInnerHTML={{ __html: flash + main }} />
    </>
  );
}
