// Central Klar payout control-plane. One dashboard for ALL connected apps.
// Server-rendered HTML, no client JS, all secrets server-side. Gated by
// KLAR_ADMIN_KEY (query ?key= once -> httpOnly cookie). Per-app data is read
// with each app's service-role key via PostgREST (see lib/adminApps).
//
// Env: KLAR_ADMIN_KEY (dashboard login), KLAR_ADMIN_APPS (JSON registry).

import { getApps, sbGet } from "../../lib/adminApps";

export const dynamic = "force-dynamic";

const KLAR_ADMIN_KEY = process.env.KLAR_ADMIN_KEY ?? "";

function ctEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
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
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const eur = (c: number | null | undefined) =>
  (Number(c ?? 0) / 100).toLocaleString("de-CH", { style: "currency", currency: "EUR" });

function page(bodyInner: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Klar Control</title></head><body style="margin:0;background:#0A0A0B;color:#F2F2F4;font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;">${bodyInner}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
function login(err?: string): Response {
  return page(`
    <div style="max-width:380px;margin:12vh auto;text-align:center;">
      <h1 style="font-size:22px;margin:0 0 4px;">Klar Control</h1>
      <p style="color:#8A8A92;font-size:13px;margin:0 0 20px;">Admin only</p>
      ${err ? `<p style="color:#FF6B6B;font-size:13px;">${esc(err)}</p>` : ""}
      <form method="GET" action="/admin">
        <input name="key" type="password" placeholder="KLAR_ADMIN_KEY" autofocus
          style="width:100%;padding:12px;border-radius:10px;border:1px solid #26262B;background:#141417;color:#F2F2F4;font-size:15px;box-sizing:border-box;" />
        <button type="submit" style="margin-top:12px;width:100%;padding:12px;border:none;border-radius:10px;background:#E8409A;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">Enter</button>
      </form>
    </div>`);
}

export async function GET(req: Request): Promise<Response> {
  if (!KLAR_ADMIN_KEY) return page(`<p style="color:#FF6B6B;">Server misconfigured: KLAR_ADMIN_KEY not set.</p>`);

  const url = new URL(req.url);
  const qKey = url.searchParams.get("key") ?? "";
  const byQuery = !!qKey && ctEqual(qKey, KLAR_ADMIN_KEY);
  const authed = byQuery || ctEqual(readCookie(req, "klar_admin"), KLAR_ADMIN_KEY);
  if (!authed) return qKey ? login("Wrong key.") : login();

  const flash = url.searchParams.get("msg");
  const apps = getApps();

  let appsHtml = "";
  if (apps.length === 0) {
    appsHtml = `<p style="color:#8A8A92;">Keine Apps konfiguriert. Setze die Env KLAR_ADMIN_APPS (JSON-Array) im klar-Vercel-Projekt.</p>`;
  }

  for (const app of apps) {
    const [influencers, claim, batches] = await Promise.all([
      sbGet(app, "influencers?select=handle,status"),
      sbGet(app, "influencer_claimable?select=handle,status,payout_method,matured_share_eur_cents,paid_eur_cents,claimable_eur_cents,unnormalized_events&order=claimable_eur_cents.desc"),
      sbGet(app, "influencer_payout_batches?select=id,period_start,period_end,status,item_count,total_amount_cents&order=created_at.desc&limit=8"),
    ]);

    const onboarded = influencers.length > 0 || claim.length > 0 || batches.length > 0;
    if (!onboarded) {
      appsHtml += `<div style="border:1px solid #26262B;border-radius:14px;padding:16px 18px;margin-bottom:16px;background:#141417;">
        <strong style="font-size:16px;">${esc(app.name)}</strong>
        <span style="color:#8A8A92;font-size:13px;margin-left:10px;">noch nicht ausgerollt (kein Affiliate-Schema/Daten)</span>
      </div>`;
      continue;
    }

    const total = influencers.length;
    const active = influencers.filter((i: any) => i.status === "active").length;
    const open = claim.reduce((s: number, c: any) => s + Number(c.claimable_eur_cents ?? 0), 0);

    const batchIds = batches.map((b: any) => b.id);
    const items = batchIds.length
      ? await sbGet(app, `influencer_payout_items?batch_id=in.(${batchIds.join(",")})&select=batch_id,influencer_handle,amount_cents,payout_method,status,provider_ref,provider_error&order=created_at.desc`)
      : [];

    const claimRows = claim.length
      ? claim.map((c: any) => `<tr>
          <td>${esc(c.handle)}</td><td>${esc(c.status)}</td><td>${esc(c.payout_method ?? "-")}</td>
          <td style="text-align:right;">${eur(c.matured_share_eur_cents)}</td>
          <td style="text-align:right;">${eur(c.paid_eur_cents)}</td>
          <td style="text-align:right;font-weight:600;">${eur(c.claimable_eur_cents)}</td>
          <td style="text-align:center;">${Number(c.unnormalized_events) > 0 ? `<span style="color:#FFB020;">${esc(c.unnormalized_events)} FX</span>` : "ok"}</td>
        </tr>`).join("")
      : `<tr><td colspan="7" style="color:#8A8A92;">keine gereiften Conversions</td></tr>`;

    const batchHtml = batches.map((b: any) => {
      const bi = items.filter((i: any) => i.batch_id === b.id);
      const rows = bi.map((i: any) => `<tr>
          <td>${esc(i.influencer_handle)}</td><td style="text-align:right;">${eur(i.amount_cents)}</td>
          <td>${esc(i.payout_method)}</td><td>${esc(i.status)}</td>
          <td style="color:#8A8A92;font-size:11px;">${esc(i.provider_ref ?? i.provider_error ?? "")}</td>
        </tr>`).join("") || `<tr><td colspan="5" style="color:#8A8A92;">keine Items</td></tr>`;
      const canDispatch = b.status === "draft" || b.status === "awaiting_release";
      const btn = canDispatch
        ? `<form method="POST" action="/admin/dispatch" style="margin:8px 0;">
             <input type="hidden" name="app" value="${esc(app.slug)}" />
             <input type="hidden" name="batch_id" value="${esc(b.id)}" />
             <button type="submit" style="padding:8px 14px;border:none;border-radius:8px;background:#E8409A;color:#fff;font-weight:600;cursor:pointer;">Via Wise vorbereiten</button>
           </form>` : "";
      return `<div style="border:1px solid #26262B;border-radius:10px;padding:12px;margin-top:10px;background:#0F0F12;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:13px;">
          <strong>${esc(b.period_start)} bis ${esc(b.period_end)}</strong>
          <span style="color:#8A8A92;">${esc(b.status)} · ${esc(b.item_count)} · ${eur(b.total_amount_cents)}</span>
        </div>${btn}
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px;">
          <thead><tr style="color:#8A8A92;text-align:left;"><th>Handle</th><th style="text-align:right;">Betrag</th><th>Methode</th><th>Status</th><th>Ref</th></tr></thead>
          <tbody>${rows}</tbody></table>
      </div>`;
    }).join("");

    appsHtml += `<div style="border:1px solid #26262B;border-radius:14px;padding:18px;margin-bottom:18px;background:#141417;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        <strong style="font-size:18px;">${esc(app.name)}</strong>
        <span style="color:#8A8A92;font-size:13px;">${total} Affiliates (${active} aktiv) · offen gesamt <strong style="color:#F2F2F4;">${eur(open)}</strong></span>
      </div>
      <form method="POST" action="/admin/reconcile" style="margin:0 0 12px;">
        <input type="hidden" name="app" value="${esc(app.slug)}" />
        <button type="submit" style="padding:7px 13px;border:1px solid #26262B;border-radius:8px;background:#1E1E22;color:#F2F2F4;font-size:13px;font-weight:600;cursor:pointer;">Status aktualisieren (Wise &rarr; DB)</button>
      </form>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="color:#8A8A92;text-align:left;border-bottom:1px solid #26262B;">
          <th>Handle</th><th>Status</th><th>Methode</th><th style="text-align:right;">Gereift</th><th style="text-align:right;">Bezahlt</th><th style="text-align:right;">Offen</th><th style="text-align:center;">FX</th>
        </tr></thead><tbody>${claimRows}</tbody>
      </table>
      ${batchHtml}
    </div>`;
  }

  const res = page(`
    <div style="max-width:1000px;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <h1 style="font-size:22px;margin:0;">Klar Control <span style="color:#8A8A92;font-size:14px;font-weight:400;">· Affiliate-Payouts alle Apps</span></h1>
        <a href="/admin/logout" style="color:#8A8A92;font-size:13px;">Logout</a>
      </div>
      ${flash ? `<div style="background:#141417;border:1px solid #26262B;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:13px;">${esc(flash)}</div>` : ""}
      <div style="background:#141417;border:1px solid #26262B;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:12px;color:#8A8A92;">
        "Via Wise vorbereiten" legt Empf&auml;nger + Transfers in Wise an, fundet NICHT. Final ausl&ouml;sen manuell in der Wise-App (2FA), danach "Status aktualisieren".
      </div>
      ${appsHtml}
    </div>`);
  if (byQuery) {
    res.headers.append(
      "Set-Cookie",
      `klar_admin=${encodeURIComponent(qKey)}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=43200`,
    );
  }
  return res;
}
