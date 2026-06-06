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
  readCookieFromString,
  adminSidebar,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import {
  getApps,
  sbGet,
  fetchAppUserStats,
  type AdminApp,
} from "../../../lib/adminApps";
import { getRcConfigs, fetchRcOverview } from "../../../lib/revenuecat";
import {
  fetchAppUserSeries,
  readMetricsHistory,
  type Bucket,
  type UserSeries,
} from "../../../lib/appMetrics";
import { KLAR_APPS, findKlarApp } from "../../../lib/klarApps";
import AnalyticsClient, {
  type AnalyticsPayload,
  type Period,
  type FunnelPayload,
  type AnalyticsTab,
  type AppsPayload,
  type AppRow,
  type AppsChartPayload,
  type AppsMetric,
} from "./AnalyticsClient";

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

// ===== Apps data: users (auth.users via RPC) + revenue (RevenueCat) =====
//
// Walks the full KLAR_APPS roster. User counts come from each connected app's
// Supabase (klar_app_stats RPC, needs KLAR_ADMIN_APPS entry). Revenue comes
// from RevenueCat's Overview metrics (needs a KLAR_REVENUECAT_KEYS entry).
// Either side degrades to "—" independently, so an app can show users without
// revenue, or neither, without breaking the others.
async function buildApps(): Promise<AppsPayload> {
  const backendApps = getApps();
  const bySlug = new Map(backendApps.map((a) => [a.slug, a]));
  const rcBySlug = new Map(getRcConfigs().map((c) => [c.slug, c]));

  const perApp: AppRow[] = await Promise.all(
    KLAR_APPS.map(async (meta) => {
      const backend = bySlug.get(meta.slug);
      const rcCfg = rcBySlug.get(meta.slug);
      const [stats, rc] = await Promise.all([
        backend ? fetchAppUserStats(backend) : Promise.resolve(null),
        rcCfg ? fetchRcOverview(rcCfg) : Promise.resolve(null),
      ]);
      return {
        slug: meta.slug,
        name: meta.name,
        icon: meta.icon,
        hasBackend: !!backend,
        usersTotal: stats?.usersTotal ?? null,
        usersNew30d: stats?.usersNew30d ?? null,
        usersNew7d: stats?.usersNew7d ?? null,
        usersActive30d: stats?.usersActive30d ?? null,
        hasRevenueCat: !!rc?.ok,
        mrr: rc?.mrr ?? null,
        revenue28d: rc?.revenue28d ?? null,
        activeSubscriptions: rc?.activeSubscriptions ?? null,
        activeTrials: rc?.activeTrials ?? null,
        currency: rc?.currency ?? "$",
      };
    }),
  );

  const totalUsers = perApp.reduce((s, a) => s + (a.usersTotal ?? 0), 0);
  const totalNew30d = perApp.reduce((s, a) => s + (a.usersNew30d ?? 0), 0);
  const totalActiveSubs = perApp.reduce((s, a) => s + (a.activeSubscriptions ?? 0), 0);
  const totalMrr = perApp.reduce((s, a) => s + (a.mrr ?? 0), 0);
  const totalRevenue28d = perApp.reduce((s, a) => s + (a.revenue28d ?? 0), 0);
  const rcApps = perApp.filter((a) => a.hasRevenueCat);
  return {
    perApp,
    totalUsers,
    totalNew30d,
    totalActiveSubs,
    totalMrr,
    totalRevenue28d,
    // Money totals assume a single display currency across RevenueCat projects
    // (typically USD); we surface the first connected app's unit.
    currency: rcApps[0]?.currency ?? "$",
    connectedCount: perApp.filter((a) => a.hasBackend).length,
    revenueCatCount: rcApps.length,
  };
}

const EMPTY_APPS: AppsPayload = {
  perApp: [],
  totalUsers: 0,
  totalNew30d: 0,
  totalActiveSubs: 0,
  totalMrr: 0,
  totalRevenue28d: 0,
  currency: "$",
  connectedCount: 0,
  revenueCatCount: 0,
};

// ===== Apps tab time-series charts (users + revenue) =====
//
// Reuses the Tremor AreaChart. Metric (users|revenue), app selection and period
// are URL-param driven (?am / ?apps / ?p_app), same server-render pattern as the
// other tabs. Users history is real (klar_app_user_series → cumulative). Revenue
// history comes from the daily snapshots in klar_app_metrics_daily.

// Stable per-app colours (assigned by KLAR_APPS order) so an app keeps its
// colour regardless of which others are toggled on.
const APP_CHART_COLORS = ["blue", "emerald", "violet", "amber", "cyan", "pink", "lime"];
function colorForSlug(slug: string): string {
  const i = KLAR_APPS.findIndex((a) => a.slug === slug);
  return APP_CHART_COLORS[(i < 0 ? 0 : i) % APP_CHART_COLORS.length];
}

function parseMetric(m: string | undefined): AppsMetric {
  return m === "revenue" ? "revenue" : "users";
}

// `apps` param = csv of slugs to show. Absent or empty => all apps on.
function parseSelectedApps(raw: string | undefined): Set<string> {
  const all = new Set(KLAR_APPS.map((a) => a.slug));
  if (!raw) return all;
  const sel = new Set(raw.split(",").map((s) => s.trim()).filter((s) => all.has(s)));
  return sel.size > 0 ? sel : all;
}

// Ordered bucket keys + display labels spanning [since, now].
function bucketTimeline(since: string, bucket: Bucket): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const startMs = new Date(since).getTime();
  const now = Date.now();
  const stepMs = bucket === "day" ? 86_400_000 : 30 * 86_400_000;
  for (let t = startMs; t <= now + 1; t += stepMs) {
    const d = new Date(t);
    const key = bucket === "day" ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7);
    const label =
      bucket === "day" ? `${key.slice(8, 10)}.${key.slice(5, 7)}` : `${key.slice(5, 7)}/${key.slice(2, 4)}`;
    if (out.length === 0 || out[out.length - 1].key !== key) out.push({ key, label });
  }
  return out;
}

async function buildAppsChart(
  metric: AppsMetric,
  period: Period,
  selected: Set<string>,
): Promise<AppsChartPayload> {
  const { since, bucket } = periodWindow(period);
  const timeline = bucketTimeline(since, bucket);
  const bySlug = new Map(getApps().map((a) => [a.slug, a]));
  const selApps = KLAR_APPS.filter((m) => selected.has(m.slug));

  const data: Record<string, number | string>[] = timeline.map((t) => ({ label: t.label }));
  const categories: string[] = [];
  const colors: string[] = [];

  if (metric === "users") {
    // Cumulative user growth per app: baseline (before window) + running sum of
    // new signups per bucket.
    const seriesBySlug = new Map<string, UserSeries | null>();
    await Promise.all(
      selApps.map(async (m) => {
        const app = bySlug.get(m.slug);
        seriesBySlug.set(m.slug, app ? await fetchAppUserSeries(app, since, bucket) : null);
      }),
    );
    for (const m of selApps) {
      const s = seriesBySlug.get(m.slug);
      if (!s) continue; // no backend / failed → no line
      categories.push(m.name);
      colors.push(colorForSlug(m.slug));
      const newByKey = new Map(s.buckets.map((b) => [b.b, b.n]));
      let cum = s.baseline;
      timeline.forEach((t, i) => {
        cum += newByKey.get(t.key) ?? 0;
        data[i][m.name] = cum;
      });
    }
  } else {
    // Revenue = MRR ($) per app, from daily snapshots; carry the last known
    // value forward across buckets without a snapshot.
    const hist = await readMetricsHistory(since);
    const valBySlugKey = new Map<string, number>();
    for (const r of hist) {
      if (!selected.has(r.app_slug)) continue;
      const key = bucket === "day" ? String(r.day).slice(0, 10) : String(r.day).slice(0, 7);
      // rows are day-ascending, so the last write per bucket wins (latest reading)
      valBySlugKey.set(`${r.app_slug}|${key}`, r.mrr_cents !== null ? Number(r.mrr_cents) / 100 : 0);
    }
    for (const m of selApps) {
      categories.push(m.name);
      colors.push(colorForSlug(m.slug));
      let last = 0;
      timeline.forEach((t, i) => {
        const v = valBySlugKey.get(`${m.slug}|${t.key}`);
        if (v !== undefined) last = v;
        data[i][m.name] = last;
      });
    }
  }

  const note =
    metric === "revenue"
      ? "Umsatz = MRR pro App ($). Die Historie baut sich ab dem ersten täglichen Snapshot auf."
      : null;

  return {
    metric,
    period,
    categories,
    colors,
    data,
    apps: KLAR_APPS.map((m) => ({
      slug: m.slug,
      name: m.name,
      on: selected.has(m.slug),
      color: colorForSlug(m.slug),
    })),
    unit: metric === "revenue" ? "$" : "",
    note,
  };
}

const EMPTY_CHART: AppsChartPayload = {
  metric: "users",
  period: "month",
  categories: [],
  colors: [],
  data: [],
  apps: [],
  unit: "",
  note: null,
};

function parseTab(t: string | undefined): AnalyticsTab {
  if (t === "public" || t === "affiliate" || t === "funnel") return t;
  return "apps";
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
  searchParams: Promise<{
    p?: string;
    tab?: string;
    p_pub?: string;
    p_aff?: string;
    p_fun?: string;
    am?: string;
    p_app?: string;
    apps?: string;
  }>;
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

  // The Apps tab doesn't read pageviews, so skip the up-to-10k-row fetch there
  // (it's the default tab, so this matters on every dashboard load).
  const rows = tab === "apps" ? [] : await fetchPageviews(since);
  const data = aggregate(rows, activePeriod, since);
  // Funnel fans out 2 Supabase calls × ~6 apps. Only the funnel tab actually
  // renders that payload, so we skip the fan-out on public/affiliate tabs
  // and hand an empty funnel to the client (it knows to display zeroes
  // there anyway because those tabs don't read it).
  const funnel: FunnelPayload =
    tab === "funnel" ? await buildFunnel(rows, since) : EMPTY_FUNNEL;
  // Apps tab fans out user-stats + RevenueCat calls per app; only build it when
  // that tab is active.
  const appsData: AppsPayload = tab === "apps" ? await buildApps() : EMPTY_APPS;
  // Apps-tab time-series chart (users|revenue), driven by ?am / ?apps / ?p_app.
  const appsMetric = parseMetric(sp.am);
  const appsChartPeriod = parsePeriod(sp.p_app);
  const appsSelected = parseSelectedApps(sp.apps);
  const appsChart: AppsChartPayload =
    tab === "apps" ? await buildAppsChart(appsMetric, appsChartPeriod, appsSelected) : EMPTY_CHART;

  const sidebar = adminSidebar("analytics", getApps());

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
      <div className="klar-aurora" aria-hidden="true" />
      <div dangerouslySetInnerHTML={{ __html: GLASS_SVG_DEFS }} />
      <div className="layout">
        <aside className="side" dangerouslySetInnerHTML={{ __html: sidebar }} />
        <main className="main">
          <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
          <div className="content">
            <h1>Analytics</h1>
            <p className="sub">
              User und Umsatz pro App, plus Web-Besucher, Affiliate-Landings und
              Conversion-Funnel. App-User aus auth.users, Umsatz aus RevenueCat.
              Web-Tracking ist privacy-friendly, keine Cookies, kein Pixel.
            </p>
            <AnalyticsClient
              data={data}
              funnel={funnel}
              appsData={appsData}
              appsChart={appsChart}
              tab={tab}
              periodPublic={pubP}
              periodAffiliate={affP}
              periodFunnel={funP}
            />
          </div>
        </main>
      </div>
    </>
  );
}
