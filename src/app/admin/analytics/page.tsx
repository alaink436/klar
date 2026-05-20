// Klar Control · Analytics view.
//
// Server component. Reads klar_pageviews from anime-vault Supabase with the
// service-role key (same key the inbox view uses), then hands the aggregates
// to <AnalyticsClient> which renders the Recharts charts. Auth gated by
// klar_admin cookie (set on first ?key= visit to /admin) or ?key=.
//
// Env: KLAR_ADMIN_KEY, KLAR_INBOX_SUPABASE_URL (default anime-vault),
//      KLAR_INBOX_SERVICE_KEY.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  STYLE,
  ICON,
  FONTS_LINK,
  THEME_INIT_SCRIPT,
  THEME_TOGGLE_SCRIPT,
  ctEqual,
  esc,
} from "../_shared";
import { getApps, sbGet } from "../../../lib/adminApps";
import { KLAR_APPS, findKlarApp } from "../../../lib/klarApps";
import AnalyticsClient, { type AnalyticsPayload, type Period } from "./AnalyticsClient";

void sbGet;
void KLAR_APPS;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const SERVICE_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

interface RawPageview {
  created_at: string;
  path: string;
  referrer: string | null;
  country: string | null;
  session_hash: string;
  ua_family: string | null;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function periodWindow(p: Period): { since: string; bucket: "day" | "month" } {
  if (p === "year") return { since: daysAgo(365), bucket: "month" };
  if (p === "month") return { since: daysAgo(30), bucket: "day" };
  return { since: daysAgo(7), bucket: "day" };
}

async function fetchPageviews(since: string): Promise<RawPageview[]> {
  if (!SERVICE_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/klar_pageviews?select=created_at,path,referrer,country,session_hash,ua_family&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=10000`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? (j as RawPageview[]) : [];
  } catch {
    return [];
  }
}

function topCounts(values: string[], n = 6): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function hostOf(url: string | null): string {
  if (!url) return "(direkt)";
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return "(unbekannt)";
  }
}

function timeline(
  rows: RawPageview[],
  bucket: "day" | "month",
  since: string,
): { label: string; visits: number; sessions: number }[] {
  const map = new Map<string, { visits: number; sessions: Set<string> }>();
  const startMs = new Date(since).getTime();
  const now = Date.now();
  const stepMs = bucket === "day" ? 86_400_000 : 30 * 86_400_000;
  for (let t = startMs; t <= now; t += stepMs) {
    const key = bucket === "day"
      ? new Date(t).toISOString().slice(0, 10)
      : new Date(t).toISOString().slice(0, 7);
    map.set(key, { visits: 0, sessions: new Set() });
  }
  for (const r of rows) {
    const key = bucket === "day" ? r.created_at.slice(0, 10) : r.created_at.slice(0, 7);
    let b = map.get(key);
    if (!b) {
      b = { visits: 0, sessions: new Set() };
      map.set(key, b);
    }
    b.visits++;
    b.sessions.add(r.session_hash);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      label: bucket === "day"
        ? `${key.slice(8, 10)}.${key.slice(5, 7)}`
        : `${key.slice(5, 7)}/${key.slice(2, 4)}`,
      visits: v.visits,
      sessions: v.sessions.size,
    }));
}

// Affiliate-Landings live at /i/<slug>/<code>. Tracking writes the path
// verbatim into klar_pageviews; we just regex-split it back out here. Slug
// is matched against KLAR_APPS so renamed paths and typos drop out.
function parseAffiliatePath(path: string): { slug: string; code: string } | null {
  const m = /^\/i\/([a-z0-9-]+)\/([^/?#]+)/i.exec(path);
  if (!m) return null;
  return { slug: m[1].toLowerCase(), code: m[2] };
}

function aggregateAffiliates(rows: RawPageview[]): AnalyticsPayload["affiliates"] {
  const perAppHits = new Map<string, number>();
  const codeHits = new Map<string, number>();
  for (const r of rows) {
    const a = parseAffiliatePath(r.path);
    if (!a) continue;
    perAppHits.set(a.slug, (perAppHits.get(a.slug) ?? 0) + 1);
    const key = `${a.slug}/${a.code}`;
    codeHits.set(key, (codeHits.get(key) ?? 0) + 1);
  }
  const perApp = [...perAppHits.entries()]
    .map(([slug, hits]) => {
      const meta = findKlarApp(slug);
      return { slug, name: meta?.name ?? slug, hits };
    })
    .sort((a, b) => b.hits - a.hits);
  const topCodes = [...codeHits.entries()]
    .map(([k, hits]) => {
      const [slug, code] = k.split("/");
      return { slug, code, hits };
    })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 8);
  const totalHits = perApp.reduce((s, a) => s + a.hits, 0);
  return { totalHits, uniqueCodes: codeHits.size, perApp, topCodes };
}

function aggregate(rows: RawPageview[], period: Period, since: string): AnalyticsPayload {
  void period;
  const { bucket } = periodWindow(period);
  const totalVisits = rows.length;
  const uniqueSessions = new Set(rows.map((r) => r.session_hash)).size;
  const series = timeline(rows, bucket, since);

  // For "Top pages" we strip affiliate landing paths so the list doesn't get
  // dominated by every individual /i/<slug>/<code>. They show up in the
  // dedicated Affiliate-Landings section instead.
  const nonAffiliate = rows.filter((r) => !parseAffiliatePath(r.path));
  const pages = topCounts(nonAffiliate.map((r) => r.path));
  const referrers = topCounts(rows.map((r) => hostOf(r.referrer)));
  const countries = topCounts(rows.map((r) => r.country ?? "??"));
  const browsers = topCounts(rows.map((r) => (r.ua_family ?? "").split(" / ")[0] || "Other"));
  const affiliates = aggregateAffiliates(rows);

  return {
    totalVisits,
    uniqueSessions,
    topPage: pages[0]?.label ?? null,
    topReferrer: referrers[0]?.label ?? null,
    series,
    pages,
    referrers,
    countries,
    browsers,
    affiliates,
  };
}

function appLinks(): string {
  return getApps()
    .map(
      (a) =>
        `<a class="nav" href="/admin?view=${encodeURIComponent(a.slug)}"><span class="d">${ICON.app}</span>${esc(a.name)}</a>`,
    )
    .join("");
}

function navItem(v: string, label: string, icon: string, on: boolean, href?: string): string {
  return `<a class="nav ${on ? "on" : ""}" href="${href ?? `/admin?view=${encodeURIComponent(v)}`}"><span class="d">${icon}</span>${esc(label)}</a>`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; p?: string }>;
}) {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) {
    return (
      <p style={{ color: "#FF6B6B", padding: 24, fontFamily: "'JetBrains Mono',monospace" }}>
        Server misconfigured: KLAR_ADMIN_KEY not set.
      </p>
    );
  }
  const sp = await searchParams;
  const queryKey = sp.key ?? "";
  const cookieStore = await cookies();
  const cookieKey = cookieStore.get("klar_admin")?.value ?? "";
  const authed = (queryKey && ctEqual(queryKey, KEY)) || ctEqual(cookieKey, KEY);
  if (!authed) {
    redirect(queryKey ? "/admin" : "/admin?msg=Bitte%20anmelden");
  }

  const period: Period = sp.p === "year" ? "year" : sp.p === "week" ? "week" : "month";
  const { since } = periodWindow(period);
  const rows = await fetchPageviews(since);
  const data = aggregate(rows, period, since);
  const apps = getApps();
  void apps;

  const sidebar = `
    <div class="brand">klar<span class="dot">.</span><small>Control</small></div>
    <div class="navsec">Studio</div>
    ${navItem("overview", "Übersicht", ICON.overview, false)}
    ${navItem("inbox", "Inbox", ICON.inbox, false)}
    ${navItem("analytics", "Analytics", ICON.analytics, true, "/admin/analytics")}
    <div class="navsec">Affiliate</div>
    ${navItem("revenue", "Einnahmen", ICON.revenue, false)}
    ${appLinks() || `<span class="nav muted"><span class="d">${ICON.app}</span>keine Apps</span>`}
    <div class="navsec">Extern</div>
    ${navItem("outreach", "Outreach", ICON.outreach, false)}
    <div class="spacer"></div>
    <a class="nav logout" href="/admin/logout"><span class="d">${ICON.logout}</span>Logout</a>
  `;

  const topbar = `
    <span class="crumb"><b>Analytics</b>${ICON.chevron}<span>Klar Control</span></span>
    <button type="button" class="tbtn" aria-label="Theme wechseln" onclick="klarToggleTheme()">${ICON.sun}${ICON.moon}</button>
  `;

  // React 19 hoists <title>, <link>, <style>, <script> into <head> automatically
  // when they appear inside a page tree. We rely on that to inject the admin
  // chrome (fonts + STYLE + theme-init/toggle) without owning <html>/<body>
  // (the root layout does that).
  return (
    <>
      <title>Analytics · Klar Control</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={FONTS_LINK} rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <h1>Analytics</h1>
            <p className="sub">
              Besucher auf getklar.org. Privacy-friendly, keine Cookies, kein Tracking-Pixel.
              Session = täglich rotierender Hash aus IP plus User-Agent.
            </p>
            <AnalyticsClient data={data} period={period} />
          </div>
        </main>
      </div>
    </>
  );
}
