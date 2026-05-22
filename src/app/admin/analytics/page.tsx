// Klar Control · Analytics view.
//
// Server component. Reads klar_pageviews from anime-vault Supabase with the
// service-role key (same key the inbox view uses), then hands the aggregates
// to <AnalyticsClient> which renders the Recharts charts. Auth gated by
// klar_admin cookie (set on first ?key= visit to /admin) or ?key=.
//
// Env: KLAR_ADMIN_KEY, KLAR_INBOX_SUPABASE_URL (default anime-vault),
//      KLAR_INBOX_SERVICE_KEY.

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
  esc,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import { getApps, sbGet, type AdminApp } from "../../../lib/adminApps";
import { KLAR_APPS, findKlarApp } from "../../../lib/klarApps";
import AnalyticsClient, {
  type AnalyticsPayload,
  type Period,
  type FunnelPayload,
  type AnalyticsTab,
} from "./AnalyticsClient";

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
    // 30s revalidate window: pageview data is for a human-readable dashboard,
    // not a realtime monitor — a half-minute stale window is fine and avoids
    // hammering Supabase on every tab/period switch.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/klar_pageviews?select=created_at,path,referrer,country,session_hash,ua_family&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=10000`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Accept: "application/json",
        },
        next: { revalidate: 30 },
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

// ===== Funnel data (Stage A) =====
//
// For each KLAR_APP (full marketing roster), we want:
//   1) Landing-clicks  -> from anime-vault klar_pageviews /i/<slug>/<code>
//   2) Install-refs    -> from that app's Supabase (sbGet)
//   3) Premium subs    -> from that app's Supabase (sbGet)
//
// Only apps registered in KLAR_ADMIN_APPS env have a connected Supabase.
// Others get hasBackend=false and the UI will surface "Backend pending".
//
// Wavelength: referrals (status counts) + referral_conversions (paid count).
// Yarn-Stash: uses Awin path — profiles.referred_by_code_id (install count)
//             + awin_conversions (premium count). We try both shapes by
//             attempting the WL shape first then YS shape per app.

interface AppFunnel {
  slug: string;
  name: string;
  hasBackend: boolean;
  clicks: number;
  installs: number;
  premiums: number;
  installRate: number; // installs / clicks
  premiumRate: number; // premiums / installs
}

function clickCountFor(slug: string, rows: RawPageview[]): number {
  let n = 0;
  for (const r of rows) {
    const a = parseAffiliatePath(r.path);
    if (a && a.slug === slug) n++;
  }
  return n;
}

async function fetchAppInstallsAndPremiums(
  app: AdminApp,
  since: string,
): Promise<{ installs: number; premiums: number; ok: boolean }> {
  // ---- Wavelength richer schema ----
  // Installs = distinct user_ids in `referrals` (clipboard/uni-link attribution).
  // Premiums = paid "initial_purchase" or "trial_conversion" events in
  // `referral_revenue_events` that actually count_for_payout (excludes
  // sandbox / self-referral / beyond-cap / paused / terminated).
  //
  // We try this shape first because it's the source-of-truth schema; if the
  // tables aren't there yet (PostgREST 404) sbGet returns [] and we fall
  // through to the generic shape below.
  try {
    const [refs, paidEvents] = await Promise.all([
      sbGet(
        app,
        `referrals?select=id,user_id&created_at=gte.${encodeURIComponent(since)}&limit=10000`,
        { revalidate: 30 },
      ),
      // Premium = paid revenue events that survived the guards. We filter
      // event_type in (initial_purchase, trial_conversion) so renewals don't
      // double-count the same user.
      sbGet(
        app,
        `referral_revenue_events?select=user_id&event_type=in.(initial_purchase,trial_conversion)&counts_for_payout=eq.true&event_at=gte.${encodeURIComponent(since)}&limit=10000`,
        { revalidate: 30 },
      ),
    ]);
    if (refs.length > 0 || paidEvents.length > 0) {
      const installs = new Set(refs.map((r) => r.user_id).filter(Boolean)).size || refs.length;
      const premiums = new Set(paidEvents.map((r) => r.user_id).filter(Boolean)).size || paidEvents.length;
      return { installs, premiums, ok: true };
    }
  } catch {
    /* fallthrough */
  }
  // ---- Yarn-Stash dual-path shape ----
  // Installs = profiles with referred_by_code_id set.
  // Premiums = approved awin_conversions OR paid referral_revenue_events if
  // both rails exist. We sum what's there.
  try {
    const [profiles, awin, paidEventsYs] = await Promise.all([
      sbGet(
        app,
        `profiles?select=id&referred_by_code_id=not.is.null&created_at=gte.${encodeURIComponent(since)}&limit=10000`,
        { revalidate: 30 },
      ),
      sbGet(
        app,
        `awin_conversions?select=id&created_at=gte.${encodeURIComponent(since)}&limit=10000`,
        { revalidate: 30 },
      ),
      sbGet(
        app,
        `referral_revenue_events?select=id&event_type=in.(initial_purchase,trial_conversion)&counts_for_payout=eq.true&event_at=gte.${encodeURIComponent(since)}&limit=10000`,
        { revalidate: 30 },
      ),
    ]);
    const installs = profiles.length;
    const premiums = awin.length + paidEventsYs.length;
    return { installs, premiums, ok: installs > 0 || premiums > 0 };
  } catch {
    return { installs: 0, premiums: 0, ok: false };
  }
}

async function buildFunnel(
  rows: RawPageview[],
  since: string,
): Promise<FunnelPayload> {
  const klarApps = KLAR_APPS;
  const backendApps = getApps();
  const bySlug = new Map(backendApps.map((a) => [a.slug, a]));
  const perApp: AppFunnel[] = await Promise.all(
    klarApps.map(async (meta) => {
      const slug = meta.slug;
      const clicks = clickCountFor(slug, rows);
      const backend = bySlug.get(slug);
      if (!backend) {
        return {
          slug,
          name: meta.name,
          hasBackend: false,
          clicks,
          installs: 0,
          premiums: 0,
          installRate: 0,
          premiumRate: 0,
        };
      }
      const r = await fetchAppInstallsAndPremiums(backend, since);
      const installRate = clicks > 0 ? r.installs / clicks : 0;
      const premiumRate = r.installs > 0 ? r.premiums / r.installs : 0;
      return {
        slug,
        name: meta.name,
        hasBackend: true,
        clicks,
        installs: r.installs,
        premiums: r.premiums,
        installRate,
        premiumRate,
      };
    }),
  );
  const totalClicks = perApp.reduce((s, a) => s + a.clicks, 0);
  const totalInstalls = perApp.reduce((s, a) => s + a.installs, 0);
  const totalPremiums = perApp.reduce((s, a) => s + a.premiums, 0);
  return { perApp, totalClicks, totalInstalls, totalPremiums };
}

function navItem(v: string, label: string, icon: string, on: boolean, href?: string): string {
  return `<a class="nav ${on ? "on" : ""}" href="${href ?? `/admin?view=${encodeURIComponent(v)}`}"><span class="d">${icon}</span>${esc(label)}</a>`;
}

function parseTab(t: string | undefined): AnalyticsTab {
  if (t === "affiliate" || t === "funnel") return t;
  return "public";
}

function parsePeriod(p: string | undefined): Period {
  if (p === "year" || p === "week") return p;
  return "month";
}

const EMPTY_FUNNEL: FunnelPayload = {
  perApp: [],
  totalClicks: 0,
  totalInstalls: 0,
  totalPremiums: 0,
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; tab?: string; p_pub?: string; p_aff?: string; p_fun?: string }>;
}) {
  // Auth: matches /admin route — requires klar_device (HMAC-verified) + klar_admin
  // session (KLAR_ADMIN_KEY equality). Both cookies are issued by /admin/login
  // after admin-key + TOTP succeed.
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  const TOTP = process.env.KLAR_TOTP_SECRET ?? "";
  if (!KEY || !DEV || !TOTP) {
    redirect("/admin/login");
  }
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const deviceRaw = readCookieFromString(cookieHeader, "klar_device");
  const device = await verifyDeviceCookie(deviceRaw, DEV);
  if (!device) redirect("/admin/login");
  const session = readCookieFromString(cookieHeader, "klar_admin");
  if (session !== KEY) redirect("/admin/login");

  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  // Per-tab period (with legacy `p` fallback so old links still work)
  const pubP = parsePeriod(sp.p_pub ?? sp.p);
  const affP = parsePeriod(sp.p_aff ?? sp.p);
  const funP = parsePeriod(sp.p_fun ?? sp.p);
  const activePeriod: Period = tab === "affiliate" ? affP : tab === "funnel" ? funP : pubP;
  const { since } = periodWindow(activePeriod);

  const rows = await fetchPageviews(since);
  const data = aggregate(rows, activePeriod, since);
  // Funnel fans out 2 Supabase calls × ~6 apps. Only the funnel tab actually
  // renders that payload, so we skip the fan-out on public/affiliate tabs
  // and hand an empty funnel to the client (it knows to display zeroes
  // there anyway because those tabs don't read it).
  const funnel: FunnelPayload =
    tab === "funnel" ? await buildFunnel(rows, since) : EMPTY_FUNNEL;

  const sidebar = `
    <a class="brand" href="/admin?view=overview" aria-label="Klar Control Home">
      <span class="brand-mark"><img src="/logo/klar-symbol.png" alt="" width="40" height="40"/></span>
      <span class="brand-text"><span class="brand-name">Klar</span><span class="brand-sub">Control</span></span>
    </a>
    <div class="navsec">Studio</div>
    ${navItem("overview", "Übersicht", ICON.overview, false)}
    ${navItem("inbox", "Inbox", ICON.inbox, false)}
    ${navItem("bookings", "Bookings", ICON.calendar, false)}
    ${navItem("cal", "Cal Admin", ICON.calendar, false)}
    ${navItem("analytics", "Analytics", ICON.analytics, true, "/admin/analytics")}
    <div class="navsec">Affiliate</div>
    ${navItem("revenue", "Einnahmen", ICON.revenue, false)}
    ${appLinks() || `<span class="nav muted"><span class="d">${ICON.app}</span>keine Apps</span>`}
    <div class="navsec">Extern</div>
    ${navItem("outreach", "Outreach", ICON.outreach, false)}
    <a class="nav" href="https://cal.getklar.org" target="_blank" rel="noopener"><span class="d">${ICON.calendar}</span>Cal in neuem Tab <span style="margin-left:auto;font-size:10px;opacity:.6">↗</span></a>
    <div class="spacer"></div>
    ${navItem("settings", "Einstellungen", ICON.lock, false, "/admin/settings")}
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
      {/* Smoke + Glass embeds (same as /admin route). suppressHydrationWarning:
          SMOKE_BG_SCRIPT sets width/height on the canvas at runtime, which is
          fine but trips React's SSR→client diff. */}
      <canvas id="klar-smoke-bg" aria-hidden="true" suppressHydrationWarning />
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <h1>Analytics</h1>
            <p className="sub">
              Besucher, Affiliate-Landings und Conversion-Funnel. Privacy-friendly,
              keine Cookies, kein Tracking-Pixel. Session = täglich rotierender Hash
              aus IP plus User-Agent.
            </p>
            <AnalyticsClient
              data={data}
              funnel={funnel}
              tab={tab}
              periodPublic={pubP}
              periodAffiliate={affP}
              periodFunnel={funP}
            />
          </div>
        </main>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SMOKE_BG_SCRIPT }} />
    </>
  );
}
