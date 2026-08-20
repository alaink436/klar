// Klar Control · Analytics view.
//
// Server component. Reads klar_pageviews from anime-vault Supabase with the
// service-role key (same key the inbox view uses), then hands the aggregates
// to <AnalyticsClient> which renders the Recharts charts. Auth gated by
// klar_admin cookie (set on first ?key= visit to /admin) or ?key=.
//
// Zwei Tabs, seit 2026-08-20:
//   Apps:     User + Umsatz pro App (auth.users, RevenueCat)
//   Landings: Aufrufe pro Landing-Page, aufgeschluesselt nach der Seite,
//              die den Traffic wirklich bekommt (myloo.org/get, kelva.space/get,
//              onwavelength.space, ...). Vorher stand hier ein Sammel-Tab
//              "Public" ueber alle getklar.org-Pfade plus zwei Tabs
//              (Affiliate-Landings, Funnel), die die Landing-Frage nicht
//              beantwortet haben. Wer optimieren will, muss pro Seite sehen,
//              was ankommt. Genau das ist jetzt der zweite Tab.
//
// Env: KLAR_ADMIN_KEY, KLAR_INBOX_SUPABASE_URL (default anime-vault),
//      KLAR_INBOX_SERVICE_KEY.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ICON,
  readCookieFromString,
} from "../_shared";
import { verifyDeviceCookie } from "../../../lib/deviceCookie";
import {
  getApps,
  fetchAppUserStats,
} from "../../../lib/adminApps";
import { getRcConfigs, fetchRcOverview } from "../../../lib/revenuecat";
import {
  fetchAppUserSeries,
  readMetricsHistory,
  type Bucket,
  type UserSeries,
} from "../../../lib/appMetrics";
import { KLAR_APPS, LISTED_APPS, resolveBackendKey } from "../../../lib/klarApps";
import {
  RESOLVED_LANDINGS,
  landingKey,
  normalizePath,
  normalizeSite,
} from "../../../lib/klarLandings";
import AnalyticsClient, {
  type Period,
  type AnalyticsTab,
  type AppsPayload,
  type AppRow,
  type AppsChartPayload,
  type AppsMetric,
  type LandingsPayload,
  type LandingRow,
} from "./AnalyticsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const SERVICE_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

interface RawPageview {
  created_at: string;
  /** Host, seit der site-Migration. Alt-Zeilen sind auf getklar.org gesetzt. */
  site: string | null;
  path: string;
  referrer: string | null;
  country: string | null;
  session_hash: string;
  ua_family: string | null;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function periodDays(p: Period): number {
  return p === "year" ? 365 : p === "month" ? 30 : 7;
}

function periodWindow(p: Period): { since: string; bucket: "day" | "month" } {
  return { since: daysAgo(periodDays(p)), bucket: p === "year" ? "month" : "day" };
}

async function fetchPageviews(since: string): Promise<RawPageview[]> {
  if (!SERVICE_KEY) return [];
  try {
    // 30s revalidate window: pageview data is for a human-readable dashboard,
    // not a realtime monitor — a half-minute stale window is fine and avoids
    // hammering Supabase on every tab/period switch.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/klar_pageviews?select=created_at,site,path,referrer,country,session_hash,ua_family&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=10000`,
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

// Affiliate-Landings liegen auf /i/<slug>/<code> und sind KEINE Landing-Pages
// im Sinne dieses Tabs: davon gibt es pro Code eine, sie wuerden die Liste
// fluten und beantworten eine andere Frage (welcher Partner bringt was).
// Sie fallen deshalb ueberall hier heraus.
function isAffiliatePath(path: string): boolean {
  return /^\/i\/[a-z0-9-]+\/[^/?#]+/i.test(path);
}

// ===== Landings: Aufrufe pro beworbener Seite =====
//
// Eine Zeile in klar_pageviews gehoert zu einer Landing, wenn (site, path) in
// KLAR_LANDINGS steht. Alles andere auf einer bekannten Landing-Domain (und
// auf getklar.org) laeuft als "Andere Seiten" mit. Das ist der Aufhaenger,
// wenn ein Pfad umbenannt wurde: die Zahl verschwindet dann nicht, sie wandert
// nur sichtbar in die Restliste, statt still auf null zu fallen.

/** Stabile Farbe pro Landing, an der Reihenfolge der Registry festgemacht. */
const LANDING_CHART_COLORS = ["blue", "emerald", "violet", "amber", "cyan", "pink", "lime", "fuchsia"];
function colorForLanding(key: string): string {
  const i = RESOLVED_LANDINGS.findIndex((l) => landingKey(l.site, l.path) === key);
  return LANDING_CHART_COLORS[(i < 0 ? 0 : i) % LANDING_CHART_COLORS.length];
}

/** Zu welcher Landing gehoert diese Zeile, oder null. */
function keyOfRow(r: RawPageview): string | null {
  const site = normalizeSite(r.site ?? "getklar.org");
  const path = normalizePath(r.path);
  const hit = RESOLVED_LANDINGS.find(
    (l) => l.site === site && normalizePath(l.path) === path,
  );
  return hit ? landingKey(hit.site, hit.path) : null;
}

function bucketOf(iso: string, bucket: Bucket): string {
  return bucket === "day" ? iso.slice(0, 10) : iso.slice(0, 7);
}

/**
 * `rows` deckt das doppelte Fenster ab: die aktuelle Periode UND die davor.
 * Der Vergleich ist der Punkt der Uebung: "42 Aufrufe" sagt nichts, "42 nach
 * 17" sagt, ob die letzte Content-Runde etwas bewegt hat.
 */
function buildLandings(
  rows: RawPageview[],
  period: Period,
  since: string,
  prevSince: string,
  selected: Set<string>,
): LandingsPayload {
  const { bucket } = periodWindow(period);
  const sinceMs = new Date(since).getTime();
  const prevMs = new Date(prevSince).getTime();

  const cur: RawPageview[] = [];
  const prev: RawPageview[] = [];
  for (const r of rows) {
    if (isAffiliatePath(r.path)) continue;
    const t = new Date(r.created_at).getTime();
    if (t >= sinceMs) cur.push(r);
    else if (t >= prevMs) prev.push(r);
  }

  const prevByKey = new Map<string, number>();
  for (const r of prev) {
    const k = keyOfRow(r);
    if (!k) continue;
    prevByKey.set(k, (prevByKey.get(k) ?? 0) + 1);
  }

  // Pro Landing sammeln: Aufrufe, Sessions, Referrer, Tagesverlauf.
  interface Acc {
    visits: number;
    sessions: Set<string>;
    referrers: string[];
    perBucket: Map<string, number>;
  }
  const acc = new Map<string, Acc>();
  const fresh = (): Acc => ({ visits: 0, sessions: new Set(), referrers: [], perBucket: new Map() });
  for (const l of RESOLVED_LANDINGS) acc.set(landingKey(l.site, l.path), fresh());

  const otherPages: string[] = [];
  for (const r of cur) {
    const k = keyOfRow(r);
    if (!k) {
      const site = normalizeSite(r.site ?? "getklar.org");
      otherPages.push(`${site}${normalizePath(r.path) === "/" ? "/" : normalizePath(r.path)}`);
      continue;
    }
    const a = acc.get(k)!;
    a.visits++;
    a.sessions.add(r.session_hash);
    a.referrers.push(hostOf(r.referrer));
    const b = bucketOf(r.created_at, bucket);
    a.perBucket.set(b, (a.perBucket.get(b) ?? 0) + 1);
  }

  const timeline = bucketTimeline(since, bucket);

  const perLanding: LandingRow[] = RESOLVED_LANDINGS.map((l) => {
    const key = landingKey(l.site, l.path);
    const a = acc.get(key)!;
    const refs = topCounts(a.referrers, 3);
    return {
      key,
      app: l.app,
      name: l.name,
      icon: l.icon,
      label: l.label,
      url: `https://${l.label}`,
      primary: l.primary,
      tracked: l.tracked,
      repo: l.repo,
      visits: a.visits,
      sessions: a.sessions.size,
      prevVisits: prevByKey.get(key) ?? 0,
      topReferrer: refs[0]?.label ?? null,
      referrers: refs,
      color: colorForLanding(key),
      spark: timeline.map((t) => a.perBucket.get(t.key) ?? 0),
    };
  }).sort((a, b) => b.visits - a.visits || Number(b.primary) - Number(a.primary));

  // Zeitreihe: eine Linie pro angehaktem Landing.
  const shown = perLanding.filter((l) => selected.has(l.key));
  const data: Record<string, number | string>[] = timeline.map((t) => ({ label: t.label }));
  const categories: string[] = [];
  const colors: string[] = [];
  for (const l of shown) {
    categories.push(l.label);
    colors.push(l.color);
    timeline.forEach((_, i) => {
      data[i][l.label] = l.spark[i] ?? 0;
    });
  }

  const totalVisits = perLanding.reduce((s, l) => s + l.visits, 0);
  const totalPrev = perLanding.reduce((s, l) => s + l.prevVisits, 0);
  const allSessions = new Set<string>();
  for (const r of cur) if (keyOfRow(r)) allSessions.add(r.session_hash);

  return {
    period,
    perLanding,
    totalVisits,
    totalPrev,
    totalSessions: allSessions.size,
    best: perLanding.find((l) => l.visits > 0)?.label ?? null,
    categories,
    colors,
    data,
    chips: perLanding.map((l) => ({
      key: l.key,
      label: l.label,
      on: selected.has(l.key),
      color: l.color,
    })),
    otherPages: topCounts(otherPages, 8),
    // Wieviele Landings liefern ueberhaupt Daten. Steht 0 da, obwohl Traffic
    // laeuft, ist der Beacon nicht deployt und nicht der Content das Problem.
    withData: perLanding.filter((l) => l.visits > 0).length,
    trackedCount: perLanding.filter((l) => l.tracked).length,
  };
}

const EMPTY_LANDINGS: LandingsPayload = {
  period: "month",
  perLanding: [],
  totalVisits: 0,
  totalPrev: 0,
  totalSessions: 0,
  best: null,
  categories: [],
  colors: [],
  data: [],
  chips: [],
  otherPages: [],
  withData: 0,
  trackedCount: 0,
};


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

  // Daily signups for the last 4 weeks: the card shows the movement, not just
  // the totals, so it needs the shape of the curve plus the week before last
  // to compare against.
  const SPARK_DAYS = 28;
  const sparkSince = daysAgo(SPARK_DAYS);

  const perApp: AppRow[] = await Promise.all(
    LISTED_APPS.map(async (meta) => {
      const backend = bySlug.get(resolveBackendKey(meta, bySlug));
      const rcCfg = rcBySlug.get(resolveBackendKey(meta, rcBySlug));
      const [stats, rc, series] = await Promise.all([
        backend ? fetchAppUserStats(backend) : Promise.resolve(null),
        rcCfg ? fetchRcOverview(rcCfg) : Promise.resolve(null),
        backend ? fetchAppUserSeries(backend, sparkSince, "day") : Promise.resolve(null),
      ]);
      // Fill the window day by day so gaps read as zero instead of collapsing
      // the curve — a day without signups is information.
      const spark: number[] = [];
      if (series) {
        const byDay = new Map(series.buckets.map((b) => [b.b, b.n]));
        for (let i = SPARK_DAYS - 1; i >= 0; i--) {
          spark.push(byDay.get(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)) ?? 0);
        }
      }
      const sum = (from: number, to: number) => spark.slice(from, to).reduce((a, b) => a + b, 0);
      return {
        slug: meta.slug,
        name: meta.name,
        icon: meta.icon,
        hasBackend: !!backend,
        usersTotal: stats?.usersTotal ?? null,
        usersNew30d: stats?.usersNew30d ?? null,
        usersNew7d: stats?.usersNew7d ?? null,
        usersActive30d: stats?.usersActive30d ?? null,
        // Last 7 days vs the 7 before them. null when there is no series at
        // all, so the card can stay quiet instead of claiming a flat zero.
        new7d: spark.length ? sum(SPARK_DAYS - 7, SPARK_DAYS) : null,
        new7dPrev: spark.length ? sum(SPARK_DAYS - 14, SPARK_DAYS - 7) : null,
        spark,
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
  const all = new Set(LISTED_APPS.map((a) => a.slug));
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
  const selApps = LISTED_APPS.filter((m) => selected.has(m.slug));

  const data: Record<string, number | string>[] = timeline.map((t) => ({ label: t.label }));
  const categories: string[] = [];
  const colors: string[] = [];

  if (metric === "users") {
    // Cumulative user growth per app: baseline (before window) + running sum of
    // new signups per bucket.
    const seriesBySlug = new Map<string, UserSeries | null>();
    await Promise.all(
      selApps.map(async (m) => {
        const app = bySlug.get(resolveBackendKey(m, bySlug));
        seriesBySlug.set(m.slug, app ? await fetchAppUserSeries(app, since, bucket) : null);
      }),
    );
    for (const m of selApps) {
      const s = seriesBySlug.get(m.slug);
      if (!s) continue; // no backend / failed → no line
      const label = m.name;
      categories.push(label);
      colors.push(colorForSlug(m.slug));
      const newByKey = new Map(s.buckets.map((b) => [b.b, b.n]));
      let cum = s.baseline;
      timeline.forEach((t, i) => {
        cum += newByKey.get(t.key) ?? 0;
        data[i][label] = cum;
      });
    }
  } else {
    // Revenue = MRR ($) per app, from daily snapshots; carry the last known
    // value forward across buckets without a snapshot.
    const hist = await readMetricsHistory(since);
    // Snapshots are keyed by the backend the numbers came from, so an app whose
    // backend was inherited (Anime Vault ← promillio) is read under that key.
    const histSlugs = new Set(hist.map((r) => r.app_slug));
    const keyFor = new Map(selApps.map((m) => [m.slug, resolveBackendKey(m, histSlugs)]));
    const selectedBackends = new Set(keyFor.values());
    const valBySlugKey = new Map<string, number>();
    for (const r of hist) {
      if (!selectedBackends.has(r.app_slug)) continue;
      const key = bucket === "day" ? String(r.day).slice(0, 10) : String(r.day).slice(0, 7);
      // rows are day-ascending, so the last write per bucket wins (latest reading)
      valBySlugKey.set(`${r.app_slug}|${key}`, r.mrr_cents !== null ? Number(r.mrr_cents) / 100 : 0);
    }
    for (const m of selApps) {
      const label = m.name;
      categories.push(label);
      colors.push(colorForSlug(m.slug));
      let last = 0;
      timeline.forEach((t, i) => {
        const v = valBySlugKey.get(`${keyFor.get(m.slug)}|${t.key}`);
        if (v !== undefined) last = v;
        data[i][label] = last;
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
    apps: LISTED_APPS.map((m) => ({
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

// Alte Links trugen tab=public|affiliate|funnel. public war die Web-Sicht und
// wird von landings abgeloest; die anderen beiden gibt es nicht mehr und
// landen auf dem Apps-Tab, statt auf einer leeren Seite.
function parseTab(t: string | undefined): AnalyticsTab {
  if (t === "landings" || t === "public") return "landings";
  return "apps";
}

function parsePeriod(p: string | undefined): Period {
  if (p === "year" || p === "week") return p;
  return "month";
}

/** `lp` = csv der angehakten Landings. Fehlt er, sind alle an. */
function parseSelectedLandings(raw: string | undefined): Set<string> {
  const all = new Set(RESOLVED_LANDINGS.map((l) => landingKey(l.site, l.path)));
  if (!raw) return all;
  const sel = new Set(raw.split(",").map((s) => s.trim()).filter((s) => all.has(s)));
  return sel.size > 0 ? sel : all;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    p?: string;
    tab?: string;
    p_pub?: string;
    am?: string;
    p_app?: string;
    apps?: string;
    lp?: string;
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
  // Periode des Landing-Tabs (mit `p` als Rueckfall, damit alte Links tragen).
  const landP = parsePeriod(sp.p_pub ?? sp.p);
  const { since } = periodWindow(landP);
  // Doppeltes Fenster: die zweite Haelfte ist der Vergleichszeitraum. Beides
  // in EINEM Fetch, weil zwei Abfragen ueber dieselbe kleine Tabelle nur
  // Latenz kosten.
  const prevSince = daysAgo(periodDays(landP) * 2);

  // The Apps tab doesn't read pageviews, so skip the up-to-10k-row fetch there
  // (it's the default tab, so this matters on every dashboard load).
  const rows = tab === "landings" ? await fetchPageviews(prevSince) : [];
  const landings: LandingsPayload =
    tab === "landings"
      ? buildLandings(rows, landP, since, prevSince, parseSelectedLandings(sp.lp))
      : EMPTY_LANDINGS;
  // Apps tab fans out user-stats + RevenueCat calls per app; only build it when
  // that tab is active.
  const appsData: AppsPayload = tab === "apps" ? await buildApps() : EMPTY_APPS;
  // Apps-tab time-series chart (users|revenue), driven by ?am / ?apps / ?p_app.
  const appsMetric = parseMetric(sp.am);
  const appsChartPeriod = parsePeriod(sp.p_app);
  const appsSelected = parseSelectedApps(sp.apps);
  const appsChart: AppsChartPayload =
    tab === "apps" ? await buildAppsChart(appsMetric, appsChartPeriod, appsSelected) : EMPTY_CHART;
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
      {/* Smoke + Glass embeds (same as /admin route). suppressHydrationWarning:
          SMOKE_BG_SCRIPT sets width/height on the canvas at runtime, which is
          fine but trips React's SSR→client diff. */}
      <div className="topbar" dangerouslySetInnerHTML={{ __html: topbar }} />
      <div className="content">
        <h1>Analytics</h1>
        <p className="sub">
          App-User kommen aus <code>auth.users</code>, Umsatz aus RevenueCat, Landing-Zahlen
          aus den eigenen Pageviews. Drei Quellen, die sich nicht gegenseitig pruefen.
          Web-Tracking ist privacy-friendly, keine Cookies, kein Pixel.
        </p>
        <AnalyticsClient
          landings={landings}
          appsData={appsData}
          appsChart={appsChart}
          tab={tab}
          periodLandings={landP}
        />
      </div>
    </>
  );
}
