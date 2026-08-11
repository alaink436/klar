// Klar Control · Übersicht (overview) — the default landing view.
//
// Server component, and the studio's work list: what is waiting on me, and
// what am I in the middle of. It reads the same per-app affiliate/outreach
// data as before, but only to answer "is something open" — the affiliate
// revenue chart, funnel and per-app table that used to sit underneath were a
// duplicate of /admin/revenue and are gone (2026-08-11). Same STYLE/ICON
// chrome and 2FA gate as the rest of /admin. Bare /admin and ?view=overview
// 303-redirect here.
//
// Env: KLAR_ADMIN_KEY, KLAR_DEVICE_SECRET, KLAR_TOTP_SECRET (+ per-app Supabase
//      keys via sbGet, and KLAR_INBOX_* for the activity feed).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ICON, readCookieFromString, esc, eur } from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, sbGet, fetchAppUserStats, type AdminApp } from "../../../lib/adminApps";
import { countOpenCollabs } from "@/lib/collabView";
import { readActiveProjects, type BrainProject } from "@/lib/brainStatus";
import { LISTED_APPS, resolveBackendKey, type KlarAppMeta } from "../../../lib/klarApps";
import { listOutreachTargets } from "../../../lib/outreachStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contact-form inbox source (anime-vault) for the overview activity feed.
const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

// Tab strip over the app roster. Apps that are wired up in KLAR_ADMIN_APPS
// link to /admin?view=<slug>; the rest are dimmed but still visible so the
// studio always sees the full portfolio at a glance. `connected` is checked
// against the BACKEND key — Anime Vault is wired up under promillio's.
function appTabStrip(connectedSlugs: Set<string>): string {
  return `<div class="app-tabs">${LISTED_APPS.map((a: KlarAppMeta) => {
    const backendSlug = resolveBackendKey(a, connectedSlugs);
    const connected = connectedSlugs.has(backendSlug);
    const badge = a.status === "LIVE"
      ? `<span class="badge live">Live</span>`
      : `<span class="badge">${esc(a.status)}</span>`;
    const inner = `${badge}
      <span class="app-icon"><img src="${esc(a.icon)}" alt="${esc(a.name)}" loading="lazy"/></span>
      <span class="app-name">${esc(a.name)}</span>
      <span class="app-meta">${connected ? "Affiliate" : "nicht verdrahtet"}</span>`;
    return connected
      ? `<a class="app-tab" href="/admin?view=${esc(backendSlug)}">${inner}</a>`
      : `<span class="app-tab dim" title="Affiliate-Schema noch nicht verdrahtet">${inner}</span>`;
  }).join("")}</div>`;
}

async function overviewMain(apps: AdminApp[]): Promise<{ htmlTop: string }> {
  const connected = new Set(apps.map((a) => a.slug));
  const tabs = appTabStrip(connected);

  // No early return when nothing is wired up: the work list and the project
  // section do not come from the affiliate backends at all (collab mail, inbox
  // enquiries, AI-Brain), and bailing out here used to blank both of them and
  // leave an affiliate-flavoured empty page behind. With apps = [] the
  // app-derived counters simply come out zero.

  const rows = await Promise.all(apps.map(async (app) => {
    // Only what the work list needs: open money, open replies, is it wired.
    // The revenue-event history lives on /admin/revenue now.
    const [inf, claim, outreach] = await Promise.all([
      sbGet(app, "influencers?select=status", { revalidate: 30 }),
      sbGet(app, "influencer_claimable?select=claimable_eur_cents,unnormalized_events", { revalidate: 30 }),
      listOutreachTargets({ platform: "all", status: "all", app: app.slug, limit: 500 }),
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
    }
    return { app, onboarded, total: inf.length, active, open, fx, angefragt, reply, angenommen };
  }));

  // Inbox-Anfragen einmal laden: neue-Anzahl (Aktions-Strip) + jüngste fürs
  // Activity-Feed. Best-effort, ohne Key/Fehler bleibt der Feed schlanker.
  let inquiriesNew = 0;
  let recentInquiries: any[] = [];
  if (KLAR_INBOX_KEY) {
    try {
      const res = await fetch(
        `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?select=email,type,status,created_at,handle&order=created_at.desc&limit=50`,
        { headers: { apikey: KLAR_INBOX_KEY, Authorization: `Bearer ${KLAR_INBOX_KEY}`, Accept: "application/json" }, next: { revalidate: 30 } },
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
  // Signale, die die Arbeitsliste braucht: wer wartet auf eine Antwort, welche
  // App ist still geworden, und woran arbeite ich gerade laut AI-Brain.
  const [collabOpen, appStats, projects] = await Promise.all([
    countOpenCollabs(),
    Promise.all(apps.map(async (a) => ({ app: a, stats: await fetchAppUserStats(a) }))),
    readActiveProjects(6),
  ]);
  // "Still" = Backend antwortet, hat User, aber seit 30 Tagen keinen neuen.
  const silentApps = appStats
    .filter((a) => a.stats !== null && a.stats.usersTotal > 0 && a.stats.usersNew30d === 0)
    .map((a) => a.app.name);

  // Nur noch die Summen, die eine Zeile in der Arbeitsliste rechtfertigen.
  // Affiliate-Bestand und Conversion-Zahlen stehen auf /admin/revenue.
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const totalAngefragt = rows.reduce((s, r) => s + r.angefragt, 0);
  const totalReply = rows.reduce((s, r) => s + r.reply, 0);

  // Schlanke Inline-SVG-Glyphen (currentColor, 2px stroke) statt Emoji — die
  // Emoji waren der größte "AI-generiert"-Tell. Stil = wie der Login-Chevron.
  const gi = (inner: string, size = 14): string =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${inner}</svg>`;
  const G = {
    send: `<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>`,
    reply: `<path d="M9 17l-5-5 5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v1"/>`,
    check: `<path d="M20 6 9 17l-5-5"/>`,
    inbox: `<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>`,
    doc: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>`,
    coin: `<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M14.5 9.5h-4a1.8 1.8 0 0 0 0 3.5h3a1.8 1.8 0 0 1 0 3.5h-4"/>`,
    pulse: `<path d="M3 12h4l3-8 4 16 3-8h4"/>`,
  };
  // ── Arbeitsliste ────────────────────────────────────────────────────────
  // Die Startseite beantwortet zuerst "was liegt bei mir?". Reihenfolge: wer
  // auf eine Antwort von mir wartet, dann Geld, dann was still geworden ist,
  // zuletzt was auf ANDERE wartet (informativ, nicht meine Aufgabe).
  const taskRow = (
    n: number,
    title: string,
    meta: string,
    href: string,
    glyph: string,
    accent: string,
  ): string =>
    n > 0
      ? `<a href="${href}" style="display:flex;align-items:center;gap:13px;padding:13px 22px;text-decoration:none;border-top:1px solid var(--line)">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--line);color:${accent};flex-shrink:0">${gi(glyph, 15)}</span>
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:13.5px;font-weight:600;color:var(--fg)">${esc(title)}</span>
        <span style="display:block;font-size:11.5px;color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(meta)}</span>
      </span>
      <span style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:${accent};font-variant-numeric:tabular-nums">${n}</span>
    </a>`
      : "";
  const tasks = [
    taskRow(collabOpen, "Collab-Anfragen beantworten", "Jemand hat an eine Bio-Adresse geschrieben und wartet", "/admin/collabs", G.inbox, "var(--warning)"),
    taskRow(inquiriesNew, "Neue Anfragen in der Inbox", "Bewerbungen und Consulting-Anfragen von der Website", "/admin/inbox", G.doc, "var(--info)"),
    taskRow(totalReply, "Outreach-Antworten offen", "Angeschriebene Creator haben geantwortet", "/admin/outreach", G.reply, "var(--warning)"),
    taskRow(rows.filter((r) => r.open > 0).length, "Auszahlungen fällig", `${eur(totalOpen)} netto und gereift`, "/admin/payouts", G.coin, "var(--fg)"),
    taskRow(silentApps.length, "Apps ohne neue User (30 Tage)", silentApps.join(", "), "/admin/analytics", G.pulse, "var(--fg-3)"),
    taskRow(totalAngefragt, "Wartet auf Antwort", "Rausgeschickt, Ball liegt bei den anderen", "/admin/outreach", G.send, "var(--fg-4)"),
  ].filter(Boolean).join("");
  const taskCard = `<div class="card" style="padding:0;display:block;margin:0 0 14px">
    <div class="k" style="padding:18px 22px 13px">Was liegt an</div>
    ${tasks || `<div class="muted" style="display:flex;align-items:center;gap:9px;padding:16px 22px;border-top:1px solid var(--line);font-size:13px">${gi(G.check, 15)} Nichts offen \u2014 keine Anfrage, keine Antwort und keine Auszahlung wartet auf dich.</div>`}
  </div>`;

  // ── Woran ich gerade arbeite ────────────────────────────────────────────
  // Gelesen aus AI-Brain/STATUS.md ("Active Now"). Das ist die Tabelle, die
  // ohnehin nach jeder Session gepflegt wird — hier nur gespiegelt, damit die
  // Startseite den Stand zeigt statt ihn ein zweites Mal zu verwalten.
  const projRow = (p: BrainProject, firstInGroup = false): string => {
    const when = p.daysAgo === null ? "" : p.daysAgo === 0 ? "heute" : p.daysAgo === 1 ? "gestern" : `vor ${p.daysAgo} Tagen`;
    const openN = p.next.length;
    const blocked = p.blockers.length > 0;
    const nextUp = (p.blockers[0] ?? p.next[0] ?? "").replace(/\u{1F534}/gu, "").trim();
    return `<div style="display:flex;align-items:flex-start;gap:13px;padding:13px 22px;${firstInGroup ? "" : "border-top:1px solid var(--line)"}">
      <span style="flex:1;min-width:0">
        <span style="display:flex;align-items:baseline;gap:9px">
          <span style="font-size:13.5px;font-weight:600;color:var(--fg)">${esc(p.name)}</span>
          <span class="muted" style="font-size:10.5px;font-family:var(--font-mono)">${esc(when)}</span>
          ${blocked ? `<span style="font-size:9.5px;font-family:var(--font-mono);font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.1em">blockiert</span>` : ""}
        </span>
        <span style="display:block;font-size:11.5px;color:var(--fg-3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.phase)}</span>
        ${nextUp ? `<span style="display:block;font-size:11.5px;color:var(--fg-2);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="muted" style="font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;margin-right:6px">als n\u00e4chstes</span>${esc(nextUp)}</span>` : ""}
      </span>
      <span style="text-align:right;flex-shrink:0">
        <span style="display:block;font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--fg);font-variant-numeric:tabular-nums">${openN}</span>
        <span class="muted" style="font-size:9.5px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.1em">offen</span>
      </span>
    </div>`;
  };
  // Nach Tagen gruppiert: "heute" und "gestern" sind das, was noch im Kopf
  // ist, alles darunter ist die Frage "liegt das jetzt brach?".
  const dayBucket = (d: number | null): string => {
    if (d === null) return "Ohne Datum";
    if (d === 0) return "Heute";
    if (d === 1) return "Gestern";
    if (d < 7) return "Diese Woche";
    if (d < 14) return "Letzte Woche";
    return "L\u00e4nger her";
  };
  const dayHead = (label: string, n: number): string =>
    `<div style="display:flex;align-items:center;gap:8px;padding:11px 22px 7px;border-top:1px solid var(--line);background:var(--surface-2)">
      <span style="font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.14em;color:var(--fg-3)">${esc(label)}</span>
      <span class="muted" style="font-family:var(--font-mono);font-size:9.5px">${n}</span>
    </div>`;
  const projectBody = (() => {
    const perBucket = new Map<string, number>();
    for (const prj of projects) {
      const b = dayBucket(prj.daysAgo);
      perBucket.set(b, (perBucket.get(b) ?? 0) + 1);
    }
    const out: string[] = [];
    let bucket = "";
    for (const prj of projects) {
      const b = dayBucket(prj.daysAgo);
      const firstInGroup = b !== bucket;
      if (firstInGroup) {
        bucket = b;
        out.push(dayHead(b, perBucket.get(b) ?? 0));
      }
      // Die Tagesgruppe zieht die Trennlinie, sonst doppelt sie sich.
      out.push(projRow(prj, firstInGroup));
    }
    return out.join("");
  })();
  const projectCard = projects.length
    ? `<div class="card" style="padding:0;display:block;margin:0 0 20px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;padding:18px 22px 13px">
          <span class="k" style="margin:0">Woran ich gerade arbeite</span>
          <a href="/admin/brain" class="applink" style="font-size:11.5px">AI-Brain \u00f6ffnen \u2192</a>
        </div>
        ${projectBody}
      </div>`
    : "";

  const htmlTop = `<h1>Übersicht</h1><p class="sub">Was gerade bei dir liegt und woran du arbeitest. Zahlen stehen unter Einnahmen und Analytics.</p>
    ${taskCard}
    ${projectCard}
    ${tabs}`;
  return { htmlTop };
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
  const { htmlTop } = await overviewMain(apps);
  const flash = sp.msg ? `<div class="flash">${esc(sp.msg)}</div>` : "";
  const topbar = `
    <span class="crumb"><b>Übersicht</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  return (
    <>
      <title>Übersicht · Klar Control</title>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <div dangerouslySetInnerHTML={{ __html: flash + htmlTop }} />
      </div>
    </>
  );
}
