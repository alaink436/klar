// Shared admin chrome: auth helpers, STYLE constant, and SVG icons.
// Imported by both /admin (route.ts, returns HTML strings) and
// /admin/analytics (page.tsx, returns JSX). Single source of truth so the
// two routes look identical.

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

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function checkAuth(req: Request): { authed: boolean; key: string; byQuery: boolean } {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return { authed: false, key: "", byQuery: false };
  const url = new URL(req.url);
  const qKey = url.searchParams.get("key") ?? "";
  const byQuery = !!qKey && ctEqual(qKey, KEY);
  const authed = byQuery || ctEqual(readCookie(req, "klar_admin"), KEY);
  return { authed, key: qKey, byQuery };
}

// Inline lucide-style SVGs, sized via parent `.nav .d` etc.
export const ICON: Record<string, string> = {
  overview:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`,
  inbox:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>`,
  revenue:
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
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
};

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
 --font-display:'Syne',system-ui,sans-serif;--font-editorial:'Fraunces',Georgia,serif;
 --font-body:'Manrope',system-ui,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;
}
[data-theme="dark"]{
 color-scheme:dark;
 --bg:#0A0A0A;--surface:#111111;--surface-2:#181818;--surface-3:#1F1F1F;
 --fg:#FAFAFA;--fg-2:#D4D4D4;--fg-3:#A3A3A3;--fg-4:#525252;
 --line:#262626;--line-strong:#404040;
 --accent:#FAFAFA;--accent-fg:#0A0A0A;
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
 --chart-1:#FAFAFA;--chart-2:#A3A3A3;--chart-3:#525252;--chart-4:#404040;--chart-fill:rgba(250,250,250,.14);
 --shadow-sm:0 1px 2px rgba(0,0,0,.3);
 --shadow:0 1px 3px rgba(0,0,0,.45),0 8px 24px -8px rgba(0,0,0,.55);
 --shadow-lg:0 4px 14px rgba(0,0,0,.55),0 18px 48px -16px rgba(0,0,0,.7);
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:14.5px;line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"kern","liga","calt"}
a{color:inherit;text-decoration:none}
::selection{background:var(--accent);color:var(--accent-fg)}

.layout{display:flex;min-height:100vh}
.side{width:240px;flex-shrink:0;border-right:1px solid var(--line);padding:18px 14px 14px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:1px;overflow-y:auto;background:linear-gradient(180deg,var(--surface) 0%,var(--bg) 100%)}
.side::-webkit-scrollbar{width:4px}
.side::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px}

.brand{font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:-.03em;padding:6px 10px 14px;display:flex;align-items:baseline;gap:6px;color:var(--fg)}
.brand .dot{color:var(--fg-3)}
.brand small{font-family:var(--font-mono);color:var(--fg-4);font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:.2em}

.navsec{font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.14em;color:var(--fg-4);padding:0 12px;margin:18px 0 6px;display:flex;align-items:center;gap:8px}
.navsec::after{content:"";flex:1;height:1px;background:var(--line)}

.nav{display:flex;align-items:center;gap:10px;padding:7px 11px;color:var(--fg-3);font-family:var(--font-body);font-size:13px;font-weight:500;border-radius:var(--radius-sm);transition:color .15s,background .15s;margin:1px 0}
.nav .d{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--fg-4);flex-shrink:0;transition:color .15s}
.nav .d svg{width:14px;height:14px;stroke-width:1.8;transition:transform .2s ease}
.nav:hover{color:var(--fg);background:var(--surface-2)}
.nav:hover .d{color:var(--fg-2)}
.nav:hover .d svg{transform:rotate(-6deg)}
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

h1{font-family:var(--font-display);font-weight:700;font-size:clamp(26px,3.4vw,34px);letter-spacing:-.025em;line-height:1.05;margin:0 0 8px;color:var(--fg)}
.sub{font-family:var(--font-editorial);font-style:italic;font-size:17px;line-height:1.45;color:var(--fg-3);margin:0 0 28px;max-width:62ch}
h2{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--fg-3);margin:32px 0 12px;display:flex;align-items:center;gap:10px}
h2::after{content:"";flex:1;height:1px;background:var(--line)}

.flash{border:1px solid var(--line-strong);border-left:3px solid var(--fg);padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:24px;font-size:13.5px;background:var(--surface);box-shadow:var(--shadow-sm);color:var(--fg-2)}

.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;position:relative;overflow:hidden}
.card::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120px 80px at 100% 0,color-mix(in oklab,var(--fg) 5%,transparent),transparent 70%);opacity:0;transition:opacity .25s ease}
.card:hover{transform:translateY(-1px);box-shadow:var(--shadow);border-color:var(--line-strong)}
.card:hover::before{opacity:1}

.k{font-family:var(--font-mono);color:var(--fg-3);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.12em}
.v{font-family:var(--font-display);font-weight:700;font-size:28px;margin-top:8px;line-height:1;letter-spacing:-.025em;font-variant-numeric:tabular-nums;color:var(--fg)}
.s{font-family:var(--font-body);color:var(--fg-3);font-size:12px;margin-top:8px;font-weight:400}

table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
th{font-family:var(--font-mono);font-size:9.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3);text-align:left;border-bottom:1px solid var(--line);padding:12px 14px;background:var(--surface-2)}
td{padding:12px 14px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums;color:var(--fg)}
tr:last-child td{border-bottom:0}
tbody tr{transition:background .12s ease}
tbody tr:hover td{background:var(--surface-2)}
.r{text-align:right}.c{text-align:center}

.pill{display:inline-block;padding:3px 10px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line-strong);border-radius:999px;color:var(--fg-2);background:var(--surface)}
.pill.live{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}

.btn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border:1px solid var(--fg);background:var(--fg);color:var(--accent-fg);font-family:var(--font-body);font-size:13px;font-weight:600;border-radius:var(--radius-sm);cursor:pointer;transition:opacity .15s,transform .12s,background .15s}
.btn:hover{opacity:.86}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:var(--surface);color:var(--fg-2);border-color:var(--line-strong)}
.btn.ghost:hover{background:var(--surface-2);color:var(--fg);opacity:1}
.btn svg{width:14px;height:14px;stroke-width:2}

.batch{border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-top:12px;background:var(--surface)}
.batch table{border:0;border-radius:0;background:transparent}
.batch th{background:transparent}

.muted{color:var(--fg-3)}
.warn{display:inline-block;color:var(--danger);background:color-mix(in oklab,var(--danger) 10%,var(--surface));border:1px solid color-mix(in oklab,var(--danger) 30%,var(--line));padding:2px 8px;border-radius:999px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.applink{font-weight:600;color:var(--fg);border-bottom:1px solid var(--line-strong);padding-bottom:1px;transition:border-color .15s,color .15s}
.applink:hover{border-color:var(--fg)}

.chart{border:1px solid var(--line);background:var(--surface);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow-sm)}
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
.app-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:0 0 28px}
.app-tab{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 12px 14px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);text-align:center;position:relative;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.app-tab:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:var(--line-strong)}
.app-tab .app-icon{width:56px;height:56px;border-radius:14px;background:var(--surface-2);overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);transition:transform .25s ease,box-shadow .25s ease,border-color .2s ease}
.app-tab .app-icon img{width:100%;height:100%;object-fit:cover;display:block}
.app-tab:hover .app-icon{transform:rotate(-5deg) scale(1.04);box-shadow:var(--shadow);border-color:var(--line-strong)}
.app-tab .app-name{font-family:var(--font-body);font-size:13px;font-weight:600;color:var(--fg);line-height:1.2;margin:0}
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

.login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(800px 400px at 80% -10%,color-mix(in oklab,var(--fg) 4%,transparent),transparent),radial-gradient(600px 300px at 10% 110%,color-mix(in oklab,var(--fg) 3%,transparent),transparent),var(--bg)}
.login-card{width:100%;max-width:380px;text-align:center;border:1px solid var(--line);background:var(--surface);border-radius:var(--radius-lg);padding:44px 36px;box-shadow:var(--shadow-lg)}
.login-badge{display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:0 auto 20px;border-radius:var(--radius);background:var(--surface-2);color:var(--fg-2)}
.login-mark{font-family:var(--font-display);font-weight:800;font-size:48px;letter-spacing:-.035em;line-height:1}
.login-mark .dot{color:var(--fg-3)}
.login-tag{font-family:var(--font-editorial);font-style:italic;font-size:16px;color:var(--fg-3);margin:10px 0 0}
.login-rule{height:1px;background:var(--line);margin:24px 0 22px}
.login-err{font-family:var(--font-mono);color:var(--danger);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:0 0 14px}
.login-input{width:100%;padding:12px 14px;border:1px solid var(--line-strong);background:var(--bg);color:var(--fg);font-size:14px;font-family:var(--font-mono);letter-spacing:.03em;border-radius:var(--radius-sm);transition:border-color .15s,box-shadow .15s}
.login-input::placeholder{color:var(--fg-4)}
.login-foot{font-family:var(--font-mono);color:var(--fg-4);font-size:10px;letter-spacing:.18em;text-transform:uppercase;margin-top:24px}

@media(prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation:none}html{scroll-behavior:auto}.card{transition:none}}
@media(max-width:820px){
 .layout{flex-direction:column}
 .side{width:auto;height:auto;position:static;flex-direction:row;flex-wrap:wrap;align-items:center;gap:4px;border-right:0;border-bottom:1px solid var(--line);padding:12px 14px;background:var(--surface)}
 .brand{width:100%;margin-bottom:4px;padding-bottom:8px}
 .navsec{display:none}.spacer{display:none}.logout{border-top:0;margin-top:0;padding-top:7px}
 .topbar{padding:12px 18px}.content{padding:24px 18px}
 h1{font-size:26px}
}
`;

export const FONTS_LINK =
  `https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Fraunces:ital@0;1&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap`;

export const THEME_INIT_SCRIPT =
  `try{var t=localStorage.getItem("klar-admin-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const THEME_TOGGLE_SCRIPT =
  `function klarToggleTheme(){var d=document.documentElement,c=d.dataset.theme,p=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light",n=(c||p)==="dark"?"light":"dark";d.dataset.theme=n;try{localStorage.setItem("klar-admin-theme",n)}catch(e){}}`;
