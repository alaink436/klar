// Shared admin chrome: auth helpers, STYLE constant, and SVG icons.
// Imported by both /admin (route.ts, returns HTML strings) and
// /admin/analytics (page.tsx, returns JSX). Single source of truth so the
// two routes look identical.

import { verifyDeviceCookie } from "../../lib/deviceCookie";

export function ctEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a),
    y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

export function readCookie(req: Request, name: string): string {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

export function readCookieFromString(raw: string, name: string): string {
  for (const part of (raw ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Relative-time label (de): heute / gestern / vor Nd / vor Nmo / vor Ny.
// Shared by route.ts (outreach/inbox/appView) + the React overview route.
export function fmtRelative(ts: string | null): string {
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

// Klar Studio is CH-based, payouts run through Wise from a CHF balance.
// DB columns are still named `*_eur_cents` for historical reasons;
// semantically they hold the reporting currency configured here.
export const REPORTING_CURRENCY = process.env.KLAR_REPORTING_CURRENCY ?? "CHF";
export const money = (c: number | null | undefined) =>
  (Number(c ?? 0) / 100).toLocaleString("de-CH", {
    style: "currency",
    currency: REPORTING_CURRENCY,
  });
// Back-compat alias so existing eur() callsites stay valid.
export const eur = money;

// Server-rendered SVG grouped bar chart. series: [{label, gross, payout}] in cents.
// Colours reference --chart-* CSS vars so the chart adapts to light/dark theme.
// Shared by /admin overview + revenue + payouts so the chart stays identical.
export function barChart(series: { label: string; gross: number; payout: number }[]): string {
  if (series.length === 0)
    return `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="13" y="7" width="3" height="10" rx="1"/></svg><div class="empty-title">Noch keine Einnahmen-Daten</div><div class="empty-sub">Sobald Affiliate-Umsatz verbucht wird, erscheint hier der Monatsverlauf.</div></div>`;
  // Tremor-style grouped bar chart: horizontal hairline grid only, rounded
  // bar tops, two monochrome series, native <title> tooltips + CSS hover.
  const W = 1000, H = 260, padL = 56, padB = 34, padT = 16, padR = 14;
  const cw = (W - padL - padR) / series.length;
  const max = Math.max(1, ...series.map((d) => Math.max(d.gross, d.payout)));
  const niceMax = Math.ceil(max / 100) * 100;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / niceMax);
  const base = y(0);
  const fmt = (cents: number) => (cents / 100).toLocaleString("de-CH");
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = niceMax * f, yy = y(val);
    return `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 4"/>
      <text x="${padL - 10}" y="${yy + 3}" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="9" fill="var(--fg-4)">${(val / 100).toFixed(0)}</text>`;
  }).join("");
  // Rounded top: rect with rx, but only the visible top should round. With thin
  // bars an rx that exceeds half the height looks off, so clamp per-bar.
  const barRect = (x: number, top: number, bw: number, cls: string, fill: string, title: string) => {
    const h = Math.max(0, base - top);
    const r = Math.min(4, bw / 2, h);
    return `<rect class="${cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${r.toFixed(1)}" fill="${fill}"><title>${title}</title></rect>`;
  };
  const bars = series.map((d, i) => {
    const x0 = padL + i * cw;
    const bw = Math.max(6, Math.min(26, cw * 0.30));
    const gx = x0 + cw / 2 - bw - 3, px = x0 + cw / 2 + 3;
    return `${barRect(gx, y(Math.max(0, d.gross)), bw, "bar", "var(--chart-1)", `${esc(d.label)} · Umsatz ${fmt(d.gross)} ${esc(REPORTING_CURRENCY)}`)}
      ${barRect(px, y(Math.max(0, d.payout)), bw, "bar", "var(--chart-2)", `${esc(d.label)} · Auszahlung ${fmt(d.payout)} ${esc(REPORTING_CURRENCY)}`)}
      <text x="${(x0 + cw / 2).toFixed(1)}" y="${H - padB + 16}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-size="9" fill="var(--fg-3)">${esc(d.label)}</text>`;
  }).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Einnahmen pro Monat">
    ${gridLines}<line x1="${padL}" y1="${base}" x2="${W - padR}" y2="${base}" stroke="var(--line-strong)" stroke-width="1"/>${bars}</svg>
    <div class="legend"><span><i style="background:var(--chart-1)"></i>Affiliate-Umsatz</span><span><i style="background:var(--chart-2)"></i>Auszahlung an Affiliates</span><span>${esc(REPORTING_CURRENCY)} pro Monat</span></div></div>`;
}

// Hardened auth:
//   1) klar_device cookie must verify against KLAR_DEVICE_SECRET (HMAC).
//      Without it, the browser is unknown and gets redirected to login.
//   2) klar_admin session cookie must equal KLAR_ADMIN_KEY (constant-time).
//      This is set by /admin/login after TOTP succeeds; 12h lifetime.
// The legacy ?key= bypass is gone — first-time setup goes through
// /admin/login which validates admin-key + TOTP and then issues both
// cookies.
export async function checkAuth(req: Request): Promise<{
  authed: boolean;
  hasDevice: boolean;
  reason: "ok" | "no-device" | "no-session" | "misconfigured";
}> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) {
    return { authed: false, hasDevice: false, reason: "misconfigured" };
  }
  const deviceRaw = readCookie(req, "klar_device");
  const device = await verifyDeviceCookie(deviceRaw, DEV);
  if (!device) return { authed: false, hasDevice: false, reason: "no-device" };
  const session = readCookie(req, "klar_admin");
  if (!ctEqual(session, KEY)) {
    return { authed: false, hasDevice: true, reason: "no-session" };
  }
  return { authed: true, hasDevice: true, reason: "ok" };
}

// Inline lucide-style SVGs, sized via parent `.nav .d` etc.
export const ICON: Record<string, string> = {
  overview:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  inbox:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>`,
  revenue:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  payouts:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`,
  analytics:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
  outreach:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
  app:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  logout:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  chevron:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  lock:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sun:
    `<svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  moon:
    `<svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>`,
  calendar:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  brain:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v13"/><path d="M3 5.5C3 4.7 3.7 4 4.5 4H9a3 3 0 0 1 3 3 3 3 0 0 1 3-3h4.5c.8 0 1.5.7 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H15a3 3 0 0 0-3 1.5 3 3 0 0 0-3-1.5H4.5A1.5 1.5 0 0 1 3 18z"/></svg>`,
};

// Shared admin sidebar — single source of truth for the nav, used by route.ts
// (HTML views) AND every React admin page (analytics, brain, settings, …) so
// the rail stays byte-identical everywhere and a view migration only touches
// ONE link here. Returns the inner HTML of <aside class="side">; callers wrap
// it (route.ts inlines it, React pages use dangerouslySetInnerHTML).
//   active: the current view key (marks the matching item ".on")
//   apps:   the app registry (per-app links); pass getApps()
export function adminSidebar(
  active: string,
  apps: { slug: string; name: string }[],
): string {
  const item = (v: string, label: string, icon: string, href?: string) =>
    `<a class="nav ${active === v ? "on" : ""}" href="${href ?? `/admin?view=${encodeURIComponent(v)}`}"><span class="d">${icon}</span>${esc(label)}</a>`;
  const appNav = apps.map((a) => item(a.slug, a.name, ICON.app)).join("");
  return `
    <a class="brand" href="/admin/overview" aria-label="Klar Control Home">
      <span class="brand-mark"><img src="/logo/klar-symbol.png" alt="" width="40" height="40"/></span>
      <span class="brand-text"><span class="brand-name">Klar</span><span class="brand-sub">Control</span></span>
    </a>
    <div class="navsec">Studio</div>
    ${item("overview", "Übersicht", ICON.overview, "/admin/overview")}
    ${item("inbox", "Inbox", ICON.inbox)}
    ${item("bookings", "Bookings", ICON.calendar, "/admin/bookings")}
    ${item("cal", "Cal Admin", ICON.calendar, "/admin/cal")}
    ${item("analytics", "Analytics", ICON.analytics, "/admin/analytics")}
    ${item("brain", "AI-Brain", ICON.brain, "/admin/brain")}
    <div class="navsec">Affiliate</div>
    ${item("revenue", "Einnahmen", ICON.revenue, "/admin/revenue")}
    ${item("payouts", "Auszahlungen", ICON.payouts, "/admin/payouts")}
    ${appNav || `<span class="nav muted"><span class="d">${ICON.app}</span>keine Apps</span>`}
    <div class="navsec">Extern</div>
    ${item("outreach", "Outreach", ICON.outreach)}
    <a class="nav" href="https://cal.getklar.org" target="_blank" rel="noopener"><span class="d">${ICON.calendar}</span>Cal in neuem Tab <span style="margin-left:auto;font-size:10px;opacity:.6">↗</span></a>
    <div class="spacer"></div>
    ${item("settings", "Einstellungen", ICON.lock, "/admin/settings")}
    <a class="nav logout" href="/admin/logout"><span class="d">${ICON.logout}</span>Logout</a>
  `;
}

// Shared CSS for /admin and /admin/analytics. Light by default, dark via
// prefers-color-scheme or [data-theme]. Inlined as a <style> tag in both
// routes so there's no extra render-blocking request.
export const STYLE = `
:root{
 color-scheme:light;
 --bg:#FAFAF7;--surface:#FFFFFF;--surface-2:#F4F4F0;--surface-3:#EAEAE5;
 --fg:#1A1A1A;--fg-2:#404040;--fg-3:#6B6B6B;--fg-4:#A8A8A0;
 --line:#E4E4DD;--line-strong:#CFCFC7;
 --accent:#1A1A1A;--accent-fg:#FAFAF7;
 --success:#16A34A;--warning:#D97706;--danger:#DC2626;--info:#2563EB;
 --chart-1:#1A1A1A;--chart-2:#525252;--chart-3:#A3A3A3;--chart-4:#D4D4D4;--chart-fill:rgba(26,26,26,.12);
 --shadow-sm:0 1px 2px rgba(0,0,0,.04);
 --shadow:0 1px 3px rgba(0,0,0,.06),0 8px 24px -8px rgba(0,0,0,.08);
 --shadow-lg:0 4px 14px rgba(0,0,0,.08),0 18px 48px -16px rgba(0,0,0,.12);
 --radius:10px;--radius-sm:6px;--radius-lg:14px;
 --font-display:'Space Grotesk',system-ui,sans-serif;--font-editorial:'Fraunces',Georgia,serif;
 --font-body:'Manrope',system-ui,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;
}
[data-theme="dark"]{
 color-scheme:dark;
 --bg:#0A0A0A;--surface:#111111;--surface-2:#181818;--surface-3:#1F1F1F;
 --fg:#FAFAFA;--fg-2:#D4D4D4;--fg-3:#A3A3A3;--fg-4:#525252;
 --line:#262626;--line-strong:#404040;
 --accent:#FAFAFA;--accent-fg:#0A0A0A;
 /* Brightened semantics so badges/deltas read on the dark glass stack */
 --success:#34D399;--warning:#FBBF24;--danger:#F87171;--info:#60A5FA;
 --chart-1:#FAFAFA;--chart-2:#A3A3A3;--chart-3:#525252;--chart-4:#404040;--chart-fill:rgba(250,250,250,.14);
 --shadow-sm:0 1px 2px rgba(0,0,0,.3);
 --shadow:0 1px 3px rgba(0,0,0,.45),0 8px 24px -8px rgba(0,0,0,.55);
 --shadow-lg:0 4px 14px rgba(0,0,0,.55),0 18px 48px -16px rgba(0,0,0,.7);
}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){
 color-scheme:dark;
 --bg:#0A0A0A;--surface:#111111;--surface-2:#181818;--surface-3:#1F1F1F;
 --fg:#FAFAFA;--fg-2:#D4D4D4;--fg-3:#A3A3A3;--fg-4:#525252;
 --line:#262626;--line-strong:#404040;--accent:#FAFAFA;--accent-fg:#0A0A0A;
 --success:#34D399;--warning:#FBBF24;--danger:#F87171;--info:#60A5FA;
 --chart-1:#FAFAFA;--chart-2:#A3A3A3;--chart-3:#525252;--chart-4:#404040;--chart-fill:rgba(250,250,250,.14);
 --shadow-sm:0 1px 2px rgba(0,0,0,.3);
 --shadow:0 1px 3px rgba(0,0,0,.45),0 8px 24px -8px rgba(0,0,0,.55);
 --shadow-lg:0 4px 14px rgba(0,0,0,.55),0 18px 48px -16px rgba(0,0,0,.7);
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:15.5px;line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"kern","liga","calt","ss01"}
a{color:inherit;text-decoration:none}
::selection{background:var(--accent);color:var(--accent-fg)}

.layout{display:flex;min-height:100vh}
.side{width:240px;flex-shrink:0;border-right:1px solid var(--line);padding:18px 14px 14px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:1px;overflow-y:auto;background:linear-gradient(180deg,var(--surface) 0%,var(--bg) 100%)}
.side::-webkit-scrollbar{width:4px}
.side::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px}

.brand{padding:6px 8px 16px;display:flex;align-items:center;gap:12px;color:var(--fg)}
.brand-mark{width:40px;height:40px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--surface-2);display:flex;align-items:center;justify-content:center;border:1px solid var(--line)}
[data-theme="dark"] .brand-mark{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.10);box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 4px 14px -6px rgba(0,0,0,.5)}
.brand-mark img{width:100%;height:100%;object-fit:contain;display:block}
.brand-text{display:flex;flex-direction:column;gap:2px;line-height:1;min-width:0}
.brand-text .brand-name{font-family:var(--font-display);font-weight:800;font-size:24px;letter-spacing:-.02em;color:var(--fg)}
.brand-text .brand-sub{font-family:var(--font-mono);color:var(--fg-4);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.22em;margin-top:3px}

.navsec{font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.14em;color:var(--fg-4);padding:0 12px;margin:18px 0 6px;display:flex;align-items:center;gap:8px}
.navsec::after{content:"";flex:1;height:1px;background:var(--line)}

.nav{display:flex;align-items:center;gap:10px;padding:7px 11px;color:var(--fg-3);font-family:var(--font-body);font-size:13px;font-weight:500;border-radius:var(--radius-sm);transition:color 90ms cubic-bezier(.2,.6,.3,1),background 90ms cubic-bezier(.2,.6,.3,1);margin:1px 0}
.nav .d{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--fg-4);flex-shrink:0;transition:color 90ms cubic-bezier(.2,.6,.3,1)}
.nav .d svg{width:14px;height:14px;stroke-width:1.8;transition:transform 140ms cubic-bezier(.2,.6,.3,1)}
.nav:hover{color:var(--fg);background:var(--surface-2)}
.nav:hover .d{color:var(--fg-2)}
.nav:hover .d svg{transform:rotate(-14deg)}
.nav.on{color:var(--fg);background:var(--surface-2);font-weight:600}
.nav.on .d{color:var(--fg)}
.nav.muted{color:var(--fg-4)}

.spacer{flex:1;min-height:18px}
.logout{color:var(--fg-4);border-top:1px solid var(--line);margin-top:8px;padding-top:12px;border-radius:0}
.logout:hover{color:var(--danger);background:transparent}
.logout:hover .d{color:var(--danger)}

.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;gap:14px;padding:14px 36px;border-bottom:1px solid var(--line);font-family:var(--font-body);font-size:13px;color:var(--fg-3);position:sticky;top:0;background:color-mix(in oklab,var(--bg) 86%,transparent);backdrop-filter:blur(10px);z-index:5}
.crumb{color:var(--fg-4);display:flex;align-items:center;gap:8px;flex:1}
.crumb b{color:var(--fg);font-weight:600}
.crumb svg{width:12px;height:12px;stroke-width:2;color:var(--fg-4)}

.tbtn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--surface);color:var(--fg-3);cursor:pointer;transition:color .15s,background .15s,border-color .15s}
.tbtn:hover{color:var(--fg);background:var(--surface-2);border-color:var(--line-strong)}
.tbtn svg{width:15px;height:15px;stroke-width:1.8}
.tbtn .sun-icon,.tbtn .moon-icon{display:none}
[data-theme="light"] .tbtn .moon-icon{display:block}
[data-theme="dark"] .tbtn .sun-icon{display:block}
:root:not([data-theme]) .tbtn .moon-icon{display:block}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .tbtn .moon-icon{display:none}:root:not([data-theme="light"]) .tbtn .sun-icon{display:block}}

.content{padding:36px;max-width:1180px;width:100%;margin:0 auto}

h1{font-family:var(--font-display);font-weight:800;font-size:clamp(34px,4.6vw,52px);letter-spacing:-.025em;line-height:1.02;margin:0 0 12px;color:var(--fg)}
.sub{font-family:var(--font-body);font-size:16px;line-height:1.55;color:var(--fg-3);margin:0 0 22px;max-width:62ch}
.sub{font-family:var(--font-editorial);font-style:italic;font-size:17px;line-height:1.45;color:var(--fg-3);margin:0 0 28px;max-width:62ch}
h2{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-3);margin:32px 0 12px;display:flex;align-items:center;gap:10px}
h2::after{content:"";flex:1;height:1px;background:var(--line)}

.flash{border:1px solid var(--line-strong);padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:24px;font-size:13.5px;background:var(--surface-2);box-shadow:var(--shadow-sm);color:var(--fg-2)}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;position:relative;overflow:hidden}
.card::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120px 80px at 100% 0,color-mix(in oklab,var(--fg) 5%,transparent),transparent 70%);opacity:0;transition:opacity .25s ease}
.card:hover{transform:translateY(-1px);box-shadow:var(--shadow);border-color:var(--line-strong)}
.card:hover::before{opacity:1}

.k{font-family:var(--font-mono);color:var(--fg-3);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.12em}
.v{font-family:var(--font-display);font-weight:800;font-size:34px;margin-top:8px;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--fg)}
.s{font-family:var(--font-body);color:var(--fg-3);font-size:13px;margin-top:8px;font-weight:500}

table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
th{font-family:var(--font-mono);font-size:9.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3);text-align:left;border-bottom:1px solid var(--line);padding:12px 14px;background:var(--surface-2)}
td{padding:12px 14px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums;color:var(--fg)}
tr:last-child td{border-bottom:0}
tbody tr{transition:background .12s ease}
tbody tr:hover td{background:var(--surface-2)}
.r{text-align:right}.c{text-align:center}

.pill{display:inline-block;padding:3px 10px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line-strong);border-radius:999px;color:var(--fg-2);background:var(--surface)}
.pill.live{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}

/* Tremor Badge — tinted pill with a leading status dot and a semantic colour.
   Colour lives only on the dot + text + a faint wash, never a loud fill, so a
   table of these stays calm. Tones: ok/info/warn/danger/neutral. */
.tbadge{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid transparent;line-height:1.5;white-space:nowrap}
.tbadge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0}
.tbadge.ok{color:var(--success);background:color-mix(in oklab,var(--success) 12%,transparent);border-color:color-mix(in oklab,var(--success) 26%,transparent)}
.tbadge.info{color:var(--info);background:color-mix(in oklab,var(--info) 12%,transparent);border-color:color-mix(in oklab,var(--info) 26%,transparent)}
.tbadge.warn{color:var(--warning);background:color-mix(in oklab,var(--warning) 14%,transparent);border-color:color-mix(in oklab,var(--warning) 28%,transparent)}
.tbadge.danger{color:var(--danger);background:color-mix(in oklab,var(--danger) 12%,transparent);border-color:color-mix(in oklab,var(--danger) 26%,transparent)}
.tbadge.neutral{color:var(--fg-3);background:var(--surface-2);border-color:var(--line)}
.tbadge.neutral::before{opacity:.7}

/* coss / Origin UI card-style table — rows read as separate cards: no outer
   chrome, row-spacing gaps, each row a bordered surface with rounded ends.
   Apply by adding .card-table to a <table>. */
.card-table{border:0;border-radius:0;background:transparent;border-collapse:separate;border-spacing:0 8px;overflow:visible}
.card-table thead th{background:transparent;border:0;padding:0 16px 2px;color:var(--fg-4)}
.card-table tbody tr{background:var(--surface);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.card-table tbody td{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--surface);padding:14px 16px}
.card-table tbody td:first-child{border-left:1px solid var(--line);border-top-left-radius:var(--radius);border-bottom-left-radius:var(--radius)}
.card-table tbody td:last-child{border-right:1px solid var(--line);border-top-right-radius:var(--radius);border-bottom-right-radius:var(--radius)}
.card-table tbody tr:hover td{background:var(--surface-2)}
.card-table tbody tr:hover{transform:translateY(-1px);box-shadow:var(--shadow-sm)}
[data-theme="dark"] .card-table tbody td{background:rgba(17,17,17,.55);border-color:rgba(255,255,255,.08);backdrop-filter:blur(18px) saturate(120%);-webkit-backdrop-filter:blur(18px) saturate(120%)}
[data-theme="dark"] .card-table tbody tr:hover td{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.14)}

.btn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border:1px solid var(--fg);background:var(--fg);color:var(--accent-fg);font-family:var(--font-body);font-size:13px;font-weight:600;border-radius:var(--radius-sm);cursor:pointer;transition:opacity .15s,transform .12s,background .15s}
.btn:hover{opacity:.86}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:var(--surface);color:var(--fg-2);border-color:var(--line-strong)}
.btn.ghost:hover{background:var(--surface-2);color:var(--fg);opacity:1}
.btn svg{width:14px;height:14px;stroke-width:2}
/* RetroUI tactile accent — reserved for the single primary CTA per view.
   Hard offset shadow on a solid border, with a real "press" on click.
   Uses --fg so it reads in both themes (black-on-light, white-on-dark). */
.btn.pop{border:1.5px solid var(--fg);box-shadow:3px 3px 0 0 var(--fg);transition:transform .09s cubic-bezier(.2,.6,.3,1),box-shadow .09s cubic-bezier(.2,.6,.3,1),opacity .15s}
.btn.pop:hover{opacity:1;transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--fg)}
.btn.pop:active{transform:translate(3px,3px);box-shadow:0 0 0 0 var(--fg)}

/* Tremor BadgeDelta — trend chip: tinted semantic background, arrow + value.
   Single sanctioned use of green/red, only for deltas. Numbers tabular. */
.delta{display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;padding:2px 8px;border-radius:999px;line-height:1.45;white-space:nowrap}
.delta svg{width:13px;height:13px;stroke-width:2.2}
.delta.up{color:var(--success);background:color-mix(in oklab,var(--success) 13%,transparent)}
.delta.down{color:var(--danger);background:color-mix(in oklab,var(--danger) 13%,transparent)}
.delta.flat{color:var(--fg-3);background:color-mix(in oklab,var(--fg) 8%,transparent)}
.delta .delta-ref{color:var(--fg-3);font-weight:400;margin-left:2px}

.batch{border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-top:12px;background:var(--surface)}
.batch table{border:0;border-radius:0;background:transparent}
.batch th{background:transparent}

.muted{color:var(--fg-3)}
.warn{display:inline-block;color:var(--danger);background:color-mix(in oklab,var(--danger) 10%,var(--surface));border:1px solid color-mix(in oklab,var(--danger) 30%,var(--line));padding:2px 8px;border-radius:999px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.applink{font-weight:600;color:var(--fg);border-bottom:1px solid var(--line-strong);padding-bottom:1px;transition:border-color .15s,color .15s}
.applink:hover{border-color:var(--fg)}

/* Origin UI / Preline empty state — centered icon + title + hint inside a
   dashed frame. Replaces bare <p class="muted"> for "nothing here yet". */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:40px 24px;border:1px dashed var(--line-strong);border-radius:var(--radius);background:var(--surface);color:var(--fg-3)}
.empty>svg{width:26px;height:26px;stroke-width:1.5;color:var(--fg-4);margin-bottom:2px}
.empty .empty-title{font-family:var(--font-body);font-weight:600;font-size:14px;color:var(--fg-2)}
.empty .empty-sub{font-size:13px;color:var(--fg-3);max-width:42ch;line-height:1.5}

.chart{border:1px solid var(--line);background:var(--surface);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow-sm)}
.chart svg .bar{transition:opacity .14s ease}
.chart svg:hover .bar{opacity:.45}
.chart svg .bar:hover{opacity:1}
.chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px;margin-bottom:28px}
.chart h3{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3);margin:0 0 14px}
.legend{font-family:var(--font-mono);font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.12em;color:var(--fg-3);margin-top:14px;display:flex;gap:22px;flex-wrap:wrap}
.legend i{display:inline-block;width:10px;height:10px;margin-right:7px;vertical-align:-1px;border-radius:2px}

.iframewrap{border:1px solid var(--line);background:#fff;border-radius:var(--radius);overflow:hidden}
iframe{width:100%;height:88vh;border:0;display:block}

.seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:var(--radius-sm);overflow:hidden;background:var(--surface)}
.seg a{padding:7px 14px;font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-3);transition:background .15s,color .15s;border-right:1px solid var(--line)}
.seg a:last-child{border-right:0}
.seg a:hover{background:var(--surface-2);color:var(--fg-2)}
.seg a.on{background:var(--fg);color:var(--accent-fg)}

/* App tab strip: horizontal scroller, one tab per Klar app. Icon on top,
   name underneath, status pill in the corner. Hover rotates the icon
   slightly and lifts the tile. */
.app-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 28px}
.app-tab{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);text-align:center;position:relative;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.app-tab:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:var(--line-strong)}
.app-tab .app-icon{width:80px;height:80px;border-radius:18px;background:var(--surface-2);overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);transition:transform .25s ease,box-shadow .25s ease,border-color .2s ease}
.app-tab .app-icon img{width:100%;height:100%;object-fit:cover;display:block}
.app-tab:hover .app-icon{transform:rotate(-5deg) scale(1.05);box-shadow:var(--shadow);border-color:var(--line-strong)}
.app-tab .app-name{font-family:var(--font-body);font-size:14px;font-weight:600;color:var(--fg);line-height:1.2;margin:0}
.app-tab .app-meta{font-family:var(--font-mono);font-size:9.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-4)}
.app-tab.dim{opacity:.78}
.app-tab.dim .app-icon{filter:grayscale(.45)}
.app-tab .badge{position:absolute;top:8px;right:8px;font-family:var(--font-mono);font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:999px;background:var(--surface-2);color:var(--fg-3);border:1px solid var(--line)}
.app-tab .badge.live{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}

::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px}
::-webkit-scrollbar-thumb:hover{background:var(--fg-4)}

@view-transition{navigation:auto}
::view-transition-old(root),::view-transition-new(root){animation-duration:160ms}
input:focus,select:focus,textarea:focus,button:focus-visible{outline:none;border-color:var(--fg);box-shadow:0 0 0 3px color-mix(in oklab,var(--fg) 12%,transparent)}

.login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(800px 400px at 80% -10%,color-mix(in oklab,var(--fg) 4%,transparent),transparent),radial-gradient(600px 300px at 10% 110%,color-mix(in oklab,var(--fg) 3%,transparent),transparent),var(--bg);position:relative}
.login-card{width:100%;max-width:430px;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:var(--radius-lg);padding:42px 38px 30px;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,var(--shadow-lg);position:relative;overflow:hidden}
.login-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),color-mix(in oklab,var(--accent) 28%,transparent))}
.login-head{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.login-badge{display:flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:15px;background:var(--surface-2);color:var(--fg-2);overflow:hidden;flex-shrink:0;border:1px solid var(--line);box-shadow:0 6px 18px -8px color-mix(in oklab,var(--fg) 25%,transparent)}
[data-theme="dark"] .login-badge{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.10);box-shadow:0 1px 0 rgba(255,255,255,.06) inset}
.login-badge img{width:30px;height:30px;object-fit:contain;display:block}
.login-head-text{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.login-eyebrow{font-family:var(--font-mono);color:var(--fg-3);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.18em}
.login-mark{font-family:var(--font-display);font-weight:800;font-size:30px;letter-spacing:-.025em;line-height:1;color:var(--fg)}
.login-mark .dot{color:var(--fg-3)}
.login-tag{font-family:var(--font-editorial);font-style:italic;font-size:17px;color:var(--fg-2);margin:0 0 26px;line-height:1.4}
.login-err{display:flex;align-items:center;gap:10px;background:color-mix(in oklab,var(--danger) 10%,transparent);border:1px solid color-mix(in oklab,var(--danger) 30%,var(--line));border-radius:8px;padding:10px 14px;color:var(--fg);font-size:13px;line-height:1.4;margin:0 0 16px}
.login-err::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--danger);flex-shrink:0}
.login-field{display:flex;flex-direction:column;gap:6px}
.login-label{font-family:var(--font-mono);color:var(--fg-3);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.14em;padding-left:2px}
.login-input{width:100%;padding:12px 14px;border:1px solid var(--line-strong);background:var(--bg);color:var(--fg);font-size:14px;font-family:var(--font-body);border-radius:var(--radius-sm);transition:border-color .15s,box-shadow .15s,background .15s}
.login-input::placeholder{color:var(--fg-4)}
.login-input:focus{border-color:var(--fg);background:var(--surface);box-shadow:0 0 0 3px color-mix(in oklab,var(--fg) 12%,transparent)}
.login-input.code{font-family:var(--font-mono);letter-spacing:.5em;text-align:center;font-size:22px;padding:14px 14px;font-weight:600}
.login-input.code::placeholder{letter-spacing:.3em;font-weight:400;font-size:14px}
/* Origin UI OTP input — six segmented digit boxes, split 3+3 with a hairline
   separator. The boxes are display-only; a hidden field name=totp carries the
   value to the POST handler. Filled + focus states mirror .login-input. */
.otp{display:flex;align-items:center;gap:10px}
.otp-group{display:flex;gap:8px;flex:1}
.otp-sep{width:11px;height:2px;border-radius:2px;background:var(--line-strong);flex-shrink:0}
/* Boxes are divs (input-otp renders a single hidden field + visual slots).
   Works for both <input> and <div> via the class selector. */
.otp-box{flex:1;min-width:0;width:100%;height:54px;display:flex;align-items:center;justify-content:center;position:relative;text-align:center;font-family:var(--font-mono);font-size:22px;font-weight:600;color:var(--fg);background:var(--bg);border:1px solid var(--line-strong);border-radius:var(--radius-sm);caret-color:var(--accent);user-select:none;transition:border-color .15s,box-shadow .15s,background .15s,transform .12s}
.otp-box:hover{border-color:var(--fg-3)}
.otp-box.filled{border-color:var(--fg-3);background:var(--surface)}
.otp-box.active,.otp-box:focus{outline:none;border-color:var(--fg);background:var(--surface);box-shadow:0 0 0 3px color-mix(in oklab,var(--fg) 12%,transparent);transform:translateY(-1px)}
.otp-caret{display:inline-block;width:2px;height:24px;background:var(--accent);border-radius:1px;animation:otp-blink 1s steps(2,start) infinite}
@keyframes otp-blink{50%{opacity:0}}
[data-theme="dark"] .otp-box{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.14)}
[data-theme="dark"] .otp-box.filled{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.28)}
[data-theme="dark"] .otp-box.active,[data-theme="dark"] .otp-box:focus{border-color:var(--fg);background:rgba(255,255,255,.08)}
@media(prefers-reduced-motion:reduce){.otp-caret{animation:none}}
.login-submit{width:100%;justify-content:center;padding:13px 16px;margin-top:6px;font-size:14px;font-weight:600;letter-spacing:.01em;font-family:var(--font-body)}
.login-submit:hover{box-shadow:0 10px 24px -10px color-mix(in oklab,var(--fg) 45%,transparent)}
.login-foot{margin-top:24px;padding-top:18px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
.login-foot-text{font-family:var(--font-mono);color:var(--fg-4);font-size:10px;letter-spacing:.16em;text-transform:uppercase}
.login-meta{position:absolute;top:18px;right:18px;display:flex;gap:8px;align-items:center;z-index:2}
.login-back{position:absolute;top:18px;left:18px;display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3);text-decoration:none;padding:7px 11px;border-radius:var(--radius-sm);border:1px solid transparent;transition:color .15s,background .15s,border-color .15s;z-index:2}
.login-back:hover{color:var(--fg);background:var(--surface-2);border-color:var(--line)}
.login-back svg{width:13px;height:13px}
@media(max-width:520px){.login-card{padding:32px 24px 26px}.login-mark{font-size:26px}.login-badge{width:44px;height:44px;border-radius:12px}.login-badge img{width:24px;height:24px}}

/* ===== Custom confirm/alert modal — replaces window.confirm in admin ===== */
.klar-modal-back{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(8,8,8,.42);backdrop-filter:blur(10px) saturate(120%);-webkit-backdrop-filter:blur(10px) saturate(120%);opacity:0;transition:opacity .18s ease}
.klar-modal-back.on{display:flex;opacity:1}
.klar-modal-card{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:26px 28px 22px;transform:translateY(8px) scale(.985);transition:transform .22s cubic-bezier(.2,.7,.3,1),box-shadow .22s ease;text-align:left;font-family:var(--font-body);color:var(--fg)}
[data-theme="dark"] .klar-modal-card{backdrop-filter:blur(28px) saturate(120%);-webkit-backdrop-filter:blur(28px) saturate(120%);background:rgba(17,17,17,.72);border:1px solid rgba(255,255,255,.12);box-shadow:0 1px 0 rgba(255,255,255,.10) inset,0 40px 80px -20px rgba(0,0,0,.7)}
.klar-modal-back.on .klar-modal-card{transform:translateY(0) scale(1)}
.klar-modal-eyebrow{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--fg-3);margin:0 0 8px;display:flex;align-items:center;gap:8px}
.klar-modal-eyebrow::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--fg-3)}
.klar-modal-card.danger .klar-modal-eyebrow{color:var(--danger)}
.klar-modal-card.danger .klar-modal-eyebrow::before{background:var(--danger)}
.klar-modal-card.warn .klar-modal-eyebrow{color:var(--warning)}
.klar-modal-card.warn .klar-modal-eyebrow::before{background:var(--warning)}
.klar-modal-title{font-family:var(--font-display);font-weight:700;font-size:21px;letter-spacing:-.015em;line-height:1.18;margin:0 0 10px;color:var(--fg)}
.klar-modal-body{font-family:var(--font-body);font-size:14px;line-height:1.55;color:var(--fg-2);margin:0 0 22px;white-space:pre-line}
.klar-modal-body code{font-family:var(--font-mono);font-size:12.5px;background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:1px 7px;color:var(--fg)}
.klar-modal-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.klar-modal-actions .btn{padding:9px 18px;font-size:13px;border-radius:var(--radius-sm);min-width:104px;justify-content:center}
.klar-modal-actions .btn.ghost{background:var(--surface);color:var(--fg-2);border:1px solid var(--line-strong)}
.klar-modal-actions .btn.danger{background:var(--danger);border-color:var(--danger);color:#fff}
[data-theme="dark"] .klar-modal-actions .btn.danger{box-shadow:0 4px 14px -4px rgba(220,38,38,.45),0 1px 0 rgba(255,255,255,.18) inset}
.klar-modal-actions .btn.danger:hover{opacity:.92}
@media(prefers-reduced-motion:reduce){.klar-modal-back,.klar-modal-card{transition:none}}
@media(max-width:520px){.klar-modal-card{padding:22px 20px 18px}.klar-modal-title{font-size:19px}.klar-modal-actions{flex-direction:column-reverse}.klar-modal-actions .btn{width:100%}}

/* ===== Liquid Glass Layer (dark-mode only, smoke-bg behind glass cards) ===== */
/* Smoke canvas: full-viewport, fixed behind everything, fades to 0 in light mode */
#klar-smoke-bg{position:fixed;inset:0;width:100vw;height:100vh;z-index:-2;display:block;opacity:0;transition:opacity .6s ease;pointer-events:none}
[data-theme="dark"] #klar-smoke-bg{opacity:.55}
/* Aurora wash disabled — pure greyscale stack on top of smoke */
.klar-aurora{display:none}
/* Dark theme: VS Ink & Steel — monochrome charcoal, glass cards over smoke */
[data-theme="dark"]{
  --bg:#0A0A0A;
  --surface:rgba(17,17,17,.62);
  --surface-2:rgba(26,26,26,.55);
  --surface-3:rgba(38,38,38,.50);
  --fg:#FAFAFA;--fg-2:#D4D4D4;--fg-3:#A3A3A3;--fg-4:#737373;
  --line:rgba(255,255,255,.07);
  --line-strong:rgba(255,255,255,.14);
  --accent:#FAFAFA;--accent-fg:#0A0A0A;
  --chart-1:#FAFAFA;--chart-2:#A3A3A3;--chart-3:#737373;--chart-4:#525252;--chart-fill:rgba(250,250,250,.18);
}
[data-theme="dark"] body{background:#0A0A0A}
/* Side rail in dark: subtle frosted vertical stripe */
[data-theme="dark"] .side{background:linear-gradient(180deg,rgba(18,18,18,.82) 0%,rgba(10,10,10,.66) 100%);backdrop-filter:blur(14px) saturate(120%);-webkit-backdrop-filter:blur(14px) saturate(120%);border-right:1px solid rgba(255,255,255,.08)}
/* Topbar in dark: thin frosted slab */
[data-theme="dark"] .topbar{background:linear-gradient(180deg,rgba(10,10,10,.6),rgba(10,10,10,.3));backdrop-filter:blur(12px) saturate(120%);-webkit-backdrop-filter:blur(12px) saturate(120%);border-bottom:1px solid rgba(255,255,255,.06)}
/* Cards in dark: liquid glass surface */
[data-theme="dark"] .card,[data-theme="dark"] .chart,[data-theme="dark"] .batch,[data-theme="dark"] .app-tab{backdrop-filter:blur(22px) saturate(120%);-webkit-backdrop-filter:blur(22px) saturate(120%);border:1px solid rgba(255,255,255,.10);box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 24px 60px -28px rgba(0,0,0,.6),0 8px 22px -16px rgba(0,0,0,.4)}
[data-theme="dark"] .card:hover,[data-theme="dark"] .app-tab:hover{border-color:rgba(255,255,255,.22);box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 30px 80px -28px rgba(0,0,0,.7),0 14px 36px -20px rgba(0,0,0,.5)}
/* Tables in dark: glass surface, soft borders */
[data-theme="dark"] table{backdrop-filter:blur(22px) saturate(120%);-webkit-backdrop-filter:blur(22px) saturate(120%);border:1px solid rgba(255,255,255,.08)}
[data-theme="dark"] th{background:rgba(20,18,28,.65)}
[data-theme="dark"] tbody tr:hover td{background:rgba(255,255,255,.04)}
/* Pills + buttons in dark: refined glass-on-glass, monochrome */
[data-theme="dark"] .pill{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.10);color:var(--fg-2)}
[data-theme="dark"] .pill.live{background:#FAFAFA;color:#0A0A0A;border-color:#FAFAFA;box-shadow:0 4px 14px -4px rgba(255,255,255,.18)}
[data-theme="dark"] .btn{background:#FAFAFA;color:#0A0A0A;border:1px solid rgba(255,255,255,.18);box-shadow:0 4px 14px -4px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.5) inset}
[data-theme="dark"] .btn:hover{box-shadow:0 8px 22px -6px rgba(0,0,0,.8),0 1px 0 rgba(255,255,255,.6) inset;transform:translateY(-1px);opacity:1}
/* Tactile pop button in dark: offset shadow wins over the glass shadow.
   Slightly dimmed white so the hard edge reads without glaring. */
[data-theme="dark"] .btn.pop{border:1.5px solid rgba(255,255,255,.85);box-shadow:3px 3px 0 0 rgba(255,255,255,.85)}
[data-theme="dark"] .btn.pop:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 rgba(255,255,255,.95)}
[data-theme="dark"] .btn.pop:active{transform:translate(3px,3px);box-shadow:0 0 0 0 rgba(255,255,255,.85)}
/* Login card glass in dark, monochrome wash */
[data-theme="dark"] .login{background:radial-gradient(900px 700px at 50% -20%,rgba(255,255,255,.05),transparent),radial-gradient(800px 600px at 50% 120%,rgba(255,255,255,.03),transparent),#0A0A0A}
[data-theme="dark"] .login-card{backdrop-filter:blur(28px) saturate(120%);-webkit-backdrop-filter:blur(28px) saturate(120%);background:rgba(17,17,17,.55);border:1px solid rgba(255,255,255,.10);box-shadow:0 1px 0 rgba(255,255,255,.10) inset,0 40px 80px -20px rgba(0,0,0,.7)}
/* Iframe-wrap in dark: glassy frame */
[data-theme="dark"] .iframewrap{background:rgba(17,17,17,.62);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}

@media(prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation:none}html{scroll-behavior:auto}.card{transition:none}#klar-smoke-bg{display:none}.klar-aurora{display:none}}
@media(max-width:820px){
 .layout{flex-direction:column}
 .side{width:auto;height:auto;position:static;flex-direction:row;flex-wrap:wrap;align-items:center;gap:4px;border-right:0;border-bottom:1px solid var(--line);padding:12px 14px;background:var(--surface)}
 .brand{width:100%;margin-bottom:4px;padding-bottom:8px}
 .navsec{display:none}.spacer{display:none}.logout{border-top:0;margin-top:0;padding-top:7px}
 .topbar{padding:12px 18px}.content{padding:24px 18px}
 h1{font-size:26px}
}
`;

// Custom confirm modal — single DOM node, reused per call. Mounted once in
// the body of every admin page. The JS helper takes over forms with
// data-klar-confirm-* attributes and intercepts their submit until the
// user clicks the primary action. Replaces all window.confirm() calls.
export const MODAL_HTML = `<div class="klar-modal-back" id="klar-modal" role="dialog" aria-modal="true" aria-labelledby="klar-modal-title" aria-describedby="klar-modal-body" hidden>
  <div class="klar-modal-card" data-klar-card>
    <p class="klar-modal-eyebrow" data-klar-eyebrow>Bestätigung</p>
    <h2 class="klar-modal-title" id="klar-modal-title" data-klar-title>Wirklich fortfahren?</h2>
    <div class="klar-modal-body" id="klar-modal-body" data-klar-body></div>
    <div class="klar-modal-actions">
      <button type="button" class="btn ghost" data-klar-cancel>Abbrechen</button>
      <button type="button" class="btn" data-klar-ok autofocus>Bestätigen</button>
    </div>
  </div>
</div>`;

export const MODAL_SCRIPT = String.raw`(function(){
  var back = document.getElementById('klar-modal');
  if (!back) return;
  var card = back.querySelector('[data-klar-card]');
  var elTitle = back.querySelector('[data-klar-title]');
  var elBody = back.querySelector('[data-klar-body]');
  var elEye = back.querySelector('[data-klar-eyebrow]');
  var btnOk = back.querySelector('[data-klar-ok]');
  var btnCancel = back.querySelector('[data-klar-cancel]');
  var lastFocused = null;
  var current = null; // { resolve }

  function close(result){
    if (!current) return;
    var r = current.resolve;
    current = null;
    back.classList.remove('on');
    back.setAttribute('hidden','');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch(e){} }
    r(result);
  }

  function open(opts){
    return new Promise(function(resolve){
      if (current) { current.resolve(false); current = null; }
      current = { resolve: resolve };
      var o = opts || {};
      var variant = o.variant || 'default'; // default | danger | warn
      var eye = o.eyebrow || (variant === 'danger' ? 'Achtung' : variant === 'warn' ? 'Hinweis' : 'Bestätigung');
      elEye.textContent = eye;
      elTitle.textContent = o.title || 'Wirklich fortfahren?';
      // body can include simple <code> escaped html; we accept either text or
      // pre-escaped html via 'html: true' opt.
      if (o.html) { elBody.innerHTML = o.body || ''; } else { elBody.textContent = o.body || ''; }
      btnOk.textContent = o.confirmText || (variant === 'danger' ? 'Löschen' : 'Bestätigen');
      btnCancel.textContent = o.cancelText || 'Abbrechen';
      card.classList.remove('danger','warn');
      if (variant === 'danger') card.classList.add('danger');
      if (variant === 'warn') card.classList.add('warn');
      btnOk.classList.remove('danger');
      if (variant === 'danger') btnOk.classList.add('danger');
      lastFocused = document.activeElement;
      back.removeAttribute('hidden');
      // force reflow so transition runs
      void back.offsetWidth;
      back.classList.add('on');
      document.body.style.overflow = 'hidden';
      setTimeout(function(){ try { btnOk.focus(); } catch(e){} }, 30);
    });
  }

  btnOk.addEventListener('click', function(){ close(true); });
  btnCancel.addEventListener('click', function(){ close(false); });
  back.addEventListener('click', function(e){ if (e.target === back) close(false); });
  document.addEventListener('keydown', function(e){
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    if (e.key === 'Enter' && document.activeElement !== btnCancel) { e.preventDefault(); close(true); }
  });

  // Public API
  window.klarConfirm = open;

  // Form helper: stick data-klar-confirm-* attrs on a <form> instead of
  // onsubmit="return confirm(...)" and the helper handles it.
  // Supported attrs:
  //   data-klar-confirm        — body text (required to opt in)
  //   data-klar-confirm-title  — title
  //   data-klar-confirm-variant — 'danger' | 'warn' | 'default'
  //   data-klar-confirm-ok     — primary button label
  //   data-klar-confirm-cancel — cancel button label
  function bind(form){
    if (form.__klarBound) return;
    form.__klarBound = true;
    form.addEventListener('submit', function(ev){
      if (form.dataset.klarConfirmed === '1') {
        form.dataset.klarConfirmed = '';
        return; // allow native submit
      }
      ev.preventDefault();
      open({
        title: form.getAttribute('data-klar-confirm-title') || undefined,
        body: form.getAttribute('data-klar-confirm') || '',
        variant: form.getAttribute('data-klar-confirm-variant') || 'default',
        confirmText: form.getAttribute('data-klar-confirm-ok') || undefined,
        cancelText: form.getAttribute('data-klar-confirm-cancel') || undefined,
      }).then(function(ok){
        if (ok) { form.dataset.klarConfirmed = '1'; form.requestSubmit ? form.requestSubmit() : form.submit(); }
      });
    });
  }
  function scan(){
    var forms = document.querySelectorAll('form[data-klar-confirm]');
    for (var i = 0; i < forms.length; i++) bind(forms[i]);
  }
  scan();
  // Late-rendered forms: rescan on DOM mutations within main.
  var mo = new MutationObserver(function(){ scan(); });
  mo.observe(document.body, { childList: true, subtree: true });
})();`;

export const FONTS_LINK =
  `https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:ital@0;1&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap`;

// Admin defaults to dark theme. Light is opt-in via toggle (persisted).
export const THEME_INIT_SCRIPT =
  `try{var t=localStorage.getItem("klar-admin-theme");document.documentElement.dataset.theme=(t==="light"||t==="dark")?t:"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export const THEME_TOGGLE_SCRIPT =
  `function klarToggleTheme(){var d=document.documentElement,c=d.dataset.theme||"dark",n=c==="dark"?"light":"dark";d.dataset.theme=n;try{localStorage.setItem("klar-admin-theme",n)}catch(e){}}`;

// Inline SVG defs for liquid-glass filters. Mounted once in <body>.
// Ported from Vertical-Scheduling glass-panel.tsx (glass-soft + glass-strong)
// and liquid-glass-button.tsx (container-glass).
export const GLASS_SVG_DEFS = `<svg class="klar-glass-defs" aria-hidden="true" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <filter id="klar-glass-soft" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.014 0.014" numOctaves="2" seed="5" result="t"/>
      <feGaussianBlur in="t" stdDeviation="2" result="bn"/>
      <feDisplacementMap in="SourceGraphic" in2="bn" scale="18" xChannelSelector="R" yChannelSelector="B" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1.2" result="fb"/>
      <feComposite in="fb" in2="fb" operator="over"/>
    </filter>
    <filter id="klar-glass-strong" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="3" result="t"/>
      <feGaussianBlur in="t" stdDeviation="2" result="bn"/>
      <feDisplacementMap in="SourceGraphic" in2="bn" scale="36" xChannelSelector="R" yChannelSelector="B" result="d"/>
      <feGaussianBlur in="d" stdDeviation="2" result="fb"/>
      <feComposite in="fb" in2="fb" operator="over"/>
    </filter>
    <filter id="klar-button-glass" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="t"/>
      <feGaussianBlur in="t" stdDeviation="2" result="bn"/>
      <feDisplacementMap in="SourceGraphic" in2="bn" scale="70" xChannelSelector="R" yChannelSelector="B" result="d"/>
      <feGaussianBlur in="d" stdDeviation="4" result="fb"/>
      <feComposite in="fb" in2="fb" operator="over"/>
    </filter>
  </defs>
</svg>`;

// Vanilla WebGL2 smoke animation, ported from VS spooky-smoke-animation.tsx.
// Renders only when theme=dark, pauses on tab-hidden, dpr*0.5 for GPU savings.
// Smoke color in violet-cyan range (Klar brand-ish), opacity moderate.
export const SMOKE_BG_SCRIPT = String.raw`(function(){
  if (typeof window === 'undefined' || !window.WebGL2RenderingContext) return;
  var c = document.getElementById('klar-smoke-bg');
  if (!c) return;
  var gl = c.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) { c.style.display = 'none'; return; }
  var VS = '#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}';
  var FS = '#version 300 es\nprecision highp float;\nout vec4 O;\nuniform float time;\nuniform vec2 resolution;\nuniform vec3 u_color;\n#define FC gl_FragCoord.xy\n#define R resolution\n#define T (time+660.)\nfloat rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}\nfloat noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}\nfloat fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}\nvoid main(){vec2 uv=(FC-.5*R)/R.y;vec3 col=vec3(1);uv.x+=.25;uv*=vec2(2,1);float n=fbm(uv*.28-vec2(T*.01,0));n=noise(uv*3.+n*2.);col.r-=fbm(uv+vec2(0,T*.015)+n);col.g-=fbm(uv*1.003+vec2(0,T*.015)+n+.003);col.b-=fbm(uv*1.006+vec2(0,T*.015)+n+.006);col=mix(col,u_color,dot(col,vec3(.21,.71,.07)));col=mix(vec3(.04),col,min(time*.1,1.));col=clamp(col,.04,1.);O=vec4(col,1);}';
  function compile(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('smoke shader:', gl.getShaderInfoLog(s)); return null; } return s; }
  var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('smoke link:', gl.getProgramInfoLog(prog)); return; }
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);
  var pos = gl.getAttribLocation(prog, 'position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'resolution'), uTime = gl.getUniformLocation(prog, 'time'), uColor = gl.getUniformLocation(prog, 'u_color');
  // Smoke colour: pure neutral grey, no hue cast
  var color = [0.45, 0.45, 0.45];
  function resize(){ var dpr = Math.max(0.5, (window.devicePixelRatio || 1) * 0.5); c.width = Math.floor(window.innerWidth * dpr); c.height = Math.floor(window.innerHeight * dpr); gl.viewport(0, 0, c.width, c.height); }
  resize(); window.addEventListener('resize', resize, { passive: true });
  var raf, last = 0, interval = 1000 / 30; // 30 fps target
  function loop(now){ raf = requestAnimationFrame(loop); if (document.hidden) return; if (now - last < interval) return; last = now; gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.uniform2f(uRes, c.width, c.height); gl.uniform1f(uTime, now * 0.001); gl.uniform3fv(uColor, color); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  raf = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) last = 0; });
})();`;
