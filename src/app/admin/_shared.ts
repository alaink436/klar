// Shared admin chrome: the STYLE constant, the theme scripts, the theme-toggle
// icons and two small helpers. admin/layout.tsx mounts STYLE and the scripts
// once for every page; the token page in tokens/route.ts renders its own HTML
// and inlines them too. The admin check lives in lib/adminSession (adapters in
// lib/adminGuard).

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Relative-time label (de): heute / gestern / vor Nd / vor Nmo / vor Ny.
// Used by the content page and lib/collabView.
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

// Theme-toggle icons for the loading skeleton (loading.tsx). The topbar and
// the login page draw their own.
export const ICON: Record<string, string> = {
  sun:
    `<svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  moon:
    `<svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>`,
};

// Shared CSS for every admin page. Light by default, dark via [data-theme] or
// prefers-color-scheme. Inlined as a <style> tag so there's no extra
// render-blocking request.
const STYLE_QUELLE = `
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
 --font-editorial:'Fraunces',Georgia,serif;
 --font-body:'Manrope',system-ui,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;
}
/* --font-display steht bewusst nicht oben: in den Seiten setzt es next/font
   (app/layout.tsx) auf body. Die Token-Seite in tokens/route.ts hat kein
   next/font, dort erbt die Schrift wie bisher von body. */
[data-theme="dark"]{
 color-scheme:dark;
 --bg:#0A0A0A;--surface:rgba(17,17,17,.62);--surface-2:rgba(26,26,26,.55);--surface-3:rgba(38,38,38,.50);
 --fg:#FAFAFA;--fg-2:#D4D4D4;--fg-3:#A3A3A3;--fg-4:#737373;
 --line:rgba(255,255,255,.07);--line-strong:rgba(255,255,255,.14);
 --accent:#FAFAFA;--accent-fg:#0A0A0A;
 --success:#34D399;--warning:#FBBF24;--danger:#F87171;--info:#60A5FA;
 --chart-1:#FAFAFA;--chart-2:#A3A3A3;--chart-3:#737373;--chart-4:#525252;--chart-fill:rgba(250,250,250,.18);
 --shadow-sm:0 1px 2px rgba(0,0,0,.3);
 --shadow:0 1px 3px rgba(0,0,0,.45),0 8px 24px -8px rgba(0,0,0,.55);
 --shadow-lg:0 4px 14px rgba(0,0,0,.55),0 18px 48px -16px rgba(0,0,0,.7);
}
/* Dunkles OS: dieser Block schlaegt [data-theme="dark"] per Spezifitaet, und
   seine Werte weichen dort ab (surface, fg-4, line, chart). Dunkel sieht also
   je nach OS-Einstellung anders aus. Nicht angeglichen, weil das das Aussehen
   aendern wuerde. */
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
/* ===== Bruecke zu den Library-Komponenten (2026-08-25) =====
   Oben stehen die Klar-Tokens. Hier bekommen die shadcn-Namen ihre Werte,
   damit alles, was aus einer Registry kommt (shadcn, animate-ui, magicui),
   ohne Nacharbeit im Klar-Look steht statt im Fabrik-Grau.

   Warum hier und nicht in globals.css: die Klar-Tokens schalten weiter oben
   in DIESEM Block zwischen hell und dunkel um. Wer sich per var() an sie
   haengt, macht die Umschaltung mit und braucht keinen zweiten Dark-Zweig.
   Genau eine Sektion, nicht drei.

   Eine Falle: --accent heisst bei uns seit je die Primaerfarbe (Tiefschwarz),
   bei shadcn ist es die leise Hover-Flaeche. Wir behalten unsere Bedeutung,
   weil der Bestand darauf steht. Wer eine Registry-Komponente holt, die
   bg-accent als Hover benutzt, bekommt eine kraeftige Flaeche und stellt sie
   auf bg-secondary um. In der Schiene ist das schon getan: --sidebar-accent
   zeigt auf --surface-2 und ist davon unberuehrt.
   (Ohne Schraegstriche geschrieben: der ganze Block ist ein Template-Literal,
   ein Gegenapostroph darin beendet die Zeichenkette.) */
:root,[data-theme="dark"],[data-theme="light"]{
 --background:var(--bg);--foreground:var(--fg);
 --card:var(--surface);--card-foreground:var(--fg);
 --popover:var(--surface);--popover-foreground:var(--fg);
 --primary:var(--accent);--primary-foreground:var(--accent-fg);
 --secondary:var(--surface-2);--secondary-foreground:var(--fg);
 --muted:var(--surface-2);--muted-foreground:var(--fg-3);
 --accent-foreground:var(--accent-fg);
 --destructive:var(--danger);--destructive-foreground:#fff;
 --border:var(--line);--input:var(--line);--ring:var(--fg-4);

 /* Die Schiene liegt auf Papier, der Inhalt als Flaeche darin. Das ist der
    Griff, den wir von Cakeday uebernehmen: der Rahmen tritt zurueck, damit
    der Inhalt vorne steht. Vorher trug die Schiene einen eigenen Verlauf und
    stand damit gleichberechtigt neben dem, was sie einrahmt. */
 --sidebar:var(--bg);--sidebar-foreground:var(--fg-2);
 --sidebar-primary:var(--accent);--sidebar-primary-foreground:var(--accent-fg);
 --sidebar-accent:var(--surface-2);--sidebar-accent-foreground:var(--fg);
 --sidebar-border:var(--line);--sidebar-ring:var(--fg-4);
}

/* Griffe an den Tabellen (siehe TabellenGriffe.tsx): Suchfeld darueber,
   Sortierung auf der Kopfzeile. Der Pfeil steht nur an der Spalte, nach der
   gerade sortiert wird; ein Pfeil an jeder Spalte waere Rauschen. */
.klar-tabellengriff{display:flex;align-items:center;gap:10px;margin:0 0 8px}
.klar-tabellengriff input[type="search"]{flex:0 1 260px;padding:6px 10px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);color:var(--fg);font-family:var(--font-body);font-size:12.5px}
.klar-tabellengriff input[type="search"]:focus{outline:none;border-color:var(--line-strong)}
.klar-tabellenzahl{font-family:var(--font-mono);font-size:10.5px;color:var(--fg-4)}
th[data-klar-sortierbar="ja"]{cursor:pointer;user-select:none}
th[data-klar-sortierbar="ja"]:hover{color:var(--fg)}
th[data-klar-sortiert="auf"]::after{content:" 91";color:var(--fg-3)}
th[data-klar-sortiert="ab"]::after{content:" 93";color:var(--fg-3)}

/* Ein Formular, das gerade laeuft (siehe FormulareOhneSprung.tsx). Frueher war
   der Beleg, dass etwas passiert, der Seitenaufbau selbst. Faellt der weg,
   braucht der Klick ein anderes Zeichen, sonst drueckt man ihn zweimal. */
form[data-klar-laeuft="ja"]{opacity:.6;pointer-events:none}
form[data-klar-laeuft="ja"] button{cursor:progress}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:15.5px;line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"kern","liga","calt","ss01"}
a{color:inherit;text-decoration:none}
::selection{background:var(--accent);color:var(--accent-fg)}

.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;gap:14px;padding:14px 36px;border-bottom:1px solid var(--line);font-family:var(--font-body);font-size:13px;color:var(--fg-3);position:sticky;top:0;background:var(--bg);z-index:5}
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

/* Seitentitel: etwas kleiner als vorher, dafuer mit einer Haarlinie, die
   nach rechts auslaeuft — sie fuellt den Platz, den die Lede-Absaetze
   frueher hatten, und bindet den Titel an die Topbar darueber. */
h1{font-family:var(--font-display);font-weight:800;font-size:clamp(30px,3.4vw,42px);letter-spacing:-.03em;line-height:1.05;margin:0 0 20px;color:var(--fg);display:flex;align-items:baseline;gap:16px}
h1::after{content:"";flex:1;height:1px;min-width:24px;background:var(--line);transform:translateY(-6px)}
/* Lede unter dem Titel. Regel dafuer (2026-08-11): er darf nur stehen, wenn
   er etwas sagt, das die Seite NICHT zeigt — woher die Zahlen kommen, was sie
   bewusst nicht enthalten, welcher Schritt von Hand bleibt. Wer den Titel
   wiederholt oder aufzaehlt was ohnehin darunter steht, wird geloescht statt
   umformuliert. */
.sub{font-family:var(--font-body);font-size:13px;line-height:1.6;color:var(--fg-3);margin:-6px 0 26px;max-width:68ch}
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

.muted{color:var(--fg-3)}
.warn{display:inline-block;color:var(--danger);background:color-mix(in oklab,var(--danger) 10%,var(--surface));border:1px solid color-mix(in oklab,var(--danger) 30%,var(--line));padding:2px 8px;border-radius:999px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.applink{font-weight:600;color:var(--fg);border-bottom:1px solid var(--line-strong);padding-bottom:1px;transition:border-color .15s,color .15s}
.applink:hover{border-color:var(--fg)}

.chart{border:1px solid var(--line);background:var(--surface);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow-sm)}
.chart svg .bar{transition:opacity .14s ease}
.chart svg:hover .bar{opacity:.45}
.chart svg .bar:hover{opacity:1}
.chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px;margin-bottom:28px}
.chart h3{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3);margin:0 0 14px}

.seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:var(--radius-sm);overflow:hidden;background:var(--surface)}
.seg a{padding:7px 14px;font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-3);transition:background .15s,color .15s;border-right:1px solid var(--line)}
.seg a:last-child{border-right:0}
.seg a:hover{background:var(--surface-2);color:var(--fg-2)}
.seg a.on{background:var(--fg);color:var(--accent-fg)}

::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--line);border-radius:999px}
::-webkit-scrollbar-thumb:hover{background:var(--fg-4)}

input:focus,select:focus,textarea:focus,button:focus-visible{outline:none;border-color:var(--fg);box-shadow:0 0 0 3px color-mix(in oklab,var(--fg) 12%,transparent)}

.login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(800px 400px at 80% -10%,color-mix(in oklab,var(--fg) 4%,transparent),transparent),radial-gradient(600px 300px at 10% 110%,color-mix(in oklab,var(--fg) 3%,transparent),transparent),var(--bg);position:relative}
.login-card{width:100%;max-width:430px;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:var(--radius-lg);padding:42px 38px 30px;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,var(--shadow-lg);position:relative;overflow:hidden}
.login-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),color-mix(in oklab,var(--accent) 28%,transparent))}
.login-head{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.login-badge{display:flex;align-items:center;justify-content:center;width:54px;height:54px;overflow:hidden;flex-shrink:0}
.login-badge img{width:30px;height:30px;object-fit:contain;display:block}
.login-head-text{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.login-eyebrow{font-family:var(--font-mono);color:var(--fg-3);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.18em}
.login-mark{font-family:var(--font-display);font-weight:800;font-size:30px;letter-spacing:-.025em;line-height:1;color:var(--fg)}
.login-mark .dot{color:var(--fg-3)}
.login-tag{font-size:13px;color:var(--fg-3);margin:0 0 26px;line-height:1.5}
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
@media(max-width:520px){.login-card{padding:32px 24px 26px}.login-mark{font-size:26px}.login-badge{width:44px;height:44px}.login-badge img{width:24px;height:24px}}

[data-theme="dark"] body{background:#0A0A0A}
/* Dunkel ist flach. Bis 2026-08-31 lag hier Milchglas: zehn backdrop-filter,
   gestapelte Schatten, Farbverlaeufe auf Schiene, Leiste, jeder Karte und jeder
   Tabelle. Das kostet pro Flaeche eine eigene Compositing-Ebene, die der Browser
   bei jedem Scrollen neu rechnet, und es sieht aus wie jedes andere Dashboard.
   Jetzt: eine Flaeche, eine Linie, kein Schatten. */
[data-theme="dark"] .topbar{background:#0A0A0A;border-bottom:1px solid var(--line)}
[data-theme="dark"] .card,[data-theme="dark"] .chart{background:var(--surface);border:1px solid var(--line);box-shadow:none}
[data-theme="dark"] .card:hover{border-color:var(--line-strong);box-shadow:none}
[data-theme="dark"] table{background:var(--surface);border:1px solid var(--line)}
[data-theme="dark"] th{background:var(--surface-2)}
[data-theme="dark"] tbody tr:hover td{background:rgba(255,255,255,.04)}
[data-theme="dark"] .pill{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.10);color:var(--fg-2)}
[data-theme="dark"] .pill.live{background:#FAFAFA;color:#0A0A0A;border-color:#FAFAFA;box-shadow:0 4px 14px -4px rgba(255,255,255,.18)}
[data-theme="dark"] .btn{background:#FAFAFA;color:#0A0A0A;border:1px solid rgba(255,255,255,.18);box-shadow:0 4px 14px -4px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.5) inset}
[data-theme="dark"] .btn:hover{box-shadow:0 8px 22px -6px rgba(0,0,0,.8),0 1px 0 rgba(255,255,255,.6) inset;transform:translateY(-1px);opacity:1}
/* Tactile pop button in dark: offset shadow wins over the button shadow.
   Slightly dimmed white so the hard edge reads without glaring. */
[data-theme="dark"] .btn.pop{border:1.5px solid rgba(255,255,255,.85);box-shadow:3px 3px 0 0 rgba(255,255,255,.85)}
[data-theme="dark"] .btn.pop:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 rgba(255,255,255,.95)}
[data-theme="dark"] .btn.pop:active{transform:translate(3px,3px);box-shadow:0 0 0 0 rgba(255,255,255,.85)}
/* Login card in dark, monochrome wash */
[data-theme="dark"] .login{background:#0A0A0A}
[data-theme="dark"] .login-card{background:var(--surface);border:1px solid var(--line);box-shadow:none}

@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.card{transition:none}}
@media(max-width:820px){
 .topbar{padding:12px 18px}.content{padding:24px 18px}
 h1{font-size:26px}
}
`;

// Der Style-Block wird in JEDE Admin-Seite inline geschrieben, Kommentare
// inklusive: gemessen am 2026-08-31 waren das 5598 von 33985 Zeichen, also
// 16,5 % jedes Seitenaufrufs fuer Text, den nur wir lesen. Sie bleiben in der
// Quelle, weil sie Entscheidungen begruenden, und fallen beim Ausliefern weg.
// Laeuft einmal beim Laden des Moduls, nicht pro Anfrage.
export const STYLE = STYLE_QUELLE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*\n+/g, "\n");

// Only for the token page in tokens/route.ts, which renders its own HTML. The
// React pages get the same families from next/font in app/layout.tsx.
export const FONTS_LINK =
  `https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap`;

// Admin defaults to dark theme. Light is opt-in via toggle (persisted).
export const THEME_INIT_SCRIPT =
  `try{var t=localStorage.getItem("klar-admin-theme");document.documentElement.dataset.theme=(t==="light"||t==="dark")?t:"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export const THEME_TOGGLE_SCRIPT =
  `function klarToggleTheme(){var d=document.documentElement,c=d.dataset.theme||"dark",n=c==="dark"?"light":"dark";d.dataset.theme=n;try{localStorage.setItem("klar-admin-theme",n)}catch(e){}}`;
