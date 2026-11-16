// SERVER ONLY. App usage numbers from PostHog for Klar Control.
//
// All Klar apps send into ONE PostHog project (the free plan allows exactly
// one) and are told apart by the `app` event property that each app registers
// once at start-up (`posthog.register({ app: 'kelva' })`). Every query here
// therefore filters on that property; a query without it would mix the apps.
//
// The personal API key lives in the vault (row "Posthog Personal Key",
// category Analytics) and is decrypted here on the server with getForProxy,
// same as the Evomi credits card does. It never reaches the browser; the page
// gets plain numbers. Results are cached five minutes per app and period,
// because PostHog answers in one to three seconds and the page is read by a
// human, not polled.
//
// Event names are the ones posthog-react-native emits with
// `captureAppLifecycleEvents`: "Application Installed", "Application Opened",
// plus "$screen" with `$screen_name` from our own ScreenTracker.
import "server-only";
import {
  stepCounts,
  TREND_DAYS,
  TREND_STEPS,
  trendPoints,
  type Funnel,
  type FunnelRow,
  type Interval,
  type Platform,
  type TrendPoint,
} from "./conversion";
import { getForProxy } from "./vault";

const POSTHOG_SECRET_ID = "5cf88b00-eb0c-4863-bc69-bf317bd6e999"; // vault: "Posthog Personal Key"
export const POSTHOG_PROJECT_ID = 277077;
export const POSTHOG_APP_URL = "https://eu.posthog.com";

export interface PosthogApp {
  /** Value of the `app` event property the app registers. */
  slug: string;
  label: string;
  /** The per-app dashboard created 2026-09-17 via the API. */
  dashboardId: number;
  /** `$app_name` as PostHog's SDK reports it, where it is not the label. */
  appName?: string;
}

export const POSTHOG_APPS: PosthogApp[] = [
  { slug: "basalt", label: "Basalt", dashboardId: 958868 },
  { slug: "kelva", label: "Kelva", dashboardId: 958869 },
  { slug: "myloo", label: "MyLoo", dashboardId: 958870, appName: "Pocketmate" },
  { slug: "anime-vault", label: "Anime Vault", dashboardId: 958871 },
];

export type UsagePeriod = 7 | 30 | 90;

export interface UsagePoint {
  /** ISO day, e.g. 2026-09-17. */
  day: string;
  /** Short label for the x axis, e.g. 17.09. */
  label: string;
  users: number;
  starts: number;
}

export interface RankedRow {
  name: string;
  count: number;
}

export interface AppUsage {
  slug: string;
  period: UsagePeriod;
  /** Unique users in the period. */
  users: number;
  /** Unique users in the last 7 days, regardless of the period. */
  users7: number;
  /** Unique users today (PostHog project timezone, Europe/Zurich). */
  usersToday: number;
  /** "Application Installed" events in the period. */
  installs: number;
  /** "Application Opened" events in the period. */
  starts: number;
  series: UsagePoint[];
  screens: RankedRow[];
  versions: RankedRow[];
  /** Milliseconds it took PostHog to answer, for the footer. */
  tookMs: number;
}

export type AppUsageResult =
  | { ok: true; usage: AppUsage; cachedAt: number }
  | { ok: false; error: string };

interface Routing {
  baseUrl: string;
  authHeader: string;
  authScheme: string;
  key: string;
}

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; result: AppUsageResult }>();

function appFilter(slug: string) {
  return [{ key: "app", value: [slug], operator: "exact", type: "event" }];
}

function events(event: string, math: "dau" | "total") {
  return [{ kind: "EventsNode", event, math }];
}

/** One PostHog query. Throws on HTTP or JSON errors; the caller decides. */
interface QueryRow {
  aggregated_value?: number;
  count?: number;
  data?: number[];
  days?: string[];
  breakdown_value?: string | string[] | null;
}

async function runQuery(routing: Routing, source: Record<string, unknown>): Promise<QueryRow[]> {
  const url = `${routing.baseUrl.replace(/\/$/, "")}/api/projects/${POSTHOG_PROJECT_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [routing.authHeader || "authorization"]: `${routing.authScheme ?? ""}${routing.key}`,
    },
    body: JSON.stringify({ query: source }),
    // Vercel's shared data cache, keyed by the query: five minutes, as the Maps below, but for every
    // instance (a Map lives in one; an admin tool mostly lands on a fresh one, 2026-11-16).
    next: { revalidate: CACHE_TTL_MS / 1000 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PostHog ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { results?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return Array.isArray(json.results) ? (json.results as QueryRow[]) : [];
}

/** A single aggregated number over the period (PostHog "BoldNumber"). */
async function boldNumber(routing: Routing, slug: string, event: string, math: "dau" | "total", dateFrom: string): Promise<number> {
  const rows = await runQuery(routing, {
    kind: "TrendsQuery",
    series: events(event, math),
    properties: appFilter(slug),
    dateRange: { date_from: dateFrom },
    trendsFilter: { display: "BoldNumber" },
  });
  return Number(rows[0]?.aggregated_value ?? 0);
}

/** Aggregated number per breakdown value, largest first. */
async function ranked(routing: Routing, slug: string, event: string, math: "dau" | "total", breakdown: string, dateFrom: string, limit: number): Promise<RankedRow[]> {
  const rows = await runQuery(routing, {
    kind: "TrendsQuery",
    series: events(event, math),
    properties: appFilter(slug),
    dateRange: { date_from: dateFrom },
    trendsFilter: { display: "ActionsBarValue" },
    breakdownFilter: { breakdown, breakdown_type: "event" },
  });
  return rows
    .map((r) => {
      const raw = Array.isArray(r.breakdown_value) ? r.breakdown_value[0] : r.breakdown_value;
      const name = raw == null || raw === "$$_posthog_breakdown_null_$$" ? "(ohne)" : raw === "$$_posthog_breakdown_other_$$" ? "(andere)" : String(raw);
      return { name, count: Number(r.aggregated_value ?? r.count ?? 0) };
    })
    .filter((r: RankedRow) => r.count > 0)
    .sort((a: RankedRow, b: RankedRow) => b.count - a.count)
    .slice(0, limit);
}

function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

/**
 * Usage numbers for one app. Never throws: a missing vault key or a PostHog
 * outage comes back as { ok: false } and the page says so in words.
 */
export async function fetchAppUsage(slug: string, period: UsagePeriod): Promise<AppUsageResult> {
  const key = `${slug}:${period}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const result = await fetchUncached(slug, period);
  // Errors are not cached, so a fixed key or a recovered PostHog shows at once.
  if (result.ok) cache.set(key, { at: Date.now(), result });
  return result;
}

async function fetchUncached(slug: string, period: UsagePeriod): Promise<AppUsageResult> {
  const routing = await getForProxy(POSTHOG_SECRET_ID, { touch: false, cached: true });
  if (!routing) return { ok: false, error: "Kein PostHog-Key im Vault (Eintrag „Posthog Personal Key“ fehlt, ist widerrufen oder hat keine Base-URL)." };
  const dateFrom = `-${period}d`;
  const t0 = Date.now();
  try {
    const [seriesRows, users, users7, usersToday, installs, starts, screens, versions] = await Promise.all([
      runQuery(routing, {
        kind: "TrendsQuery",
        series: [
          { kind: "EventsNode", event: "Application Opened", math: "dau" },
          { kind: "EventsNode", event: "Application Opened", math: "total" },
        ],
        properties: appFilter(slug),
        interval: "day",
        dateRange: { date_from: dateFrom },
      }),
      boldNumber(routing, slug, "Application Opened", "dau", dateFrom),
      boldNumber(routing, slug, "Application Opened", "dau", "-7d"),
      boldNumber(routing, slug, "Application Opened", "dau", "dStart"),
      boldNumber(routing, slug, "Application Installed", "total", dateFrom),
      boldNumber(routing, slug, "Application Opened", "total", dateFrom),
      ranked(routing, slug, "$screen", "total", "$screen_name", dateFrom, 12),
      ranked(routing, slug, "Application Opened", "dau", "$app_version", "-7d", 8),
    ]);
    const days: string[] = seriesRows[0]?.days ?? [];
    const dau: number[] = seriesRows[0]?.data ?? [];
    const tot: number[] = seriesRows[1]?.data ?? [];
    const series: UsagePoint[] = days.map((day, i) => ({
      day,
      label: dayLabel(day),
      users: Number(dau[i] ?? 0),
      starts: Number(tot[i] ?? 0),
    }));
    return {
      ok: true,
      cachedAt: Date.now(),
      usage: { slug, period, users, users7, usersToday, installs, starts, series, screens, versions, tookMs: Date.now() - t0 },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Deep link to the app's dashboard in PostHog, for the "open there" button. */
export function posthogDashboardUrl(app: PosthogApp): string {
  return `${POSTHOG_APP_URL}/project/${POSTHOG_PROJECT_ID}/dashboard/${app.dashboardId}`;
}

// ---------------------------------------------------------------------------
// Conversion (Alain, 2026-11-16): PostHog's own funnel per app, its rates over time, and the new users
// per week and build. Ported from the OurApps dashboard; here the key comes from the vault as above.
//
// Both apps send the same names (Basalt and Kelva, measured 2026-11-16): iap_paywall_viewed (pro=true is a
// Pro user looking at their own plan), iap_purchase_start on the buy tap, iap_purchase_result with result
// 'ok'. A trial is a purchase whose intro price has only zeros ("$0.00", "0,00 €"); a paid intro (£4.99)
// is a purchase. Sandbox buys (own tests, App Review) are out. "Application Installed" fires before the
// app registers `app`, so the funnel tells apps apart by `$app_name` ("Basalt", "Basalt - Follow Through").

/** The apps whose paywall sends the iap_ events; the others would show an empty funnel. */
export const CONVERSION_APPS = POSTHOG_APPS.filter((a) => a.slug === "basalt" || a.slug === "kelva");

const prop = (key: string, value: unknown, operator: string) => ({ key, value, operator, type: "event" });
const PURCHASE_OK = [prop("result", ["ok"], "exact"), prop("sandbox", ["true"], "is_not")];
const FREE_INTRO = [prop("intro", "[0-9]", "regex"), prop("intro", "[1-9]", "not_regex")];
// iPads report iPadOS; for Klar Control they are iOS.
const OS_NAMES: Record<Platform, string[]> = { ios: ["iOS", "iPadOS"], android: ["Android"] };

function funnelQuery(
  appName: string,
  days: number,
  platform: Platform | null,
  trialsOnly: boolean,
  trend?: { from: number; to: number; interval: Interval },
): Record<string, unknown> {
  const funnelsFilter: Record<string, unknown> = {
    funnelVizType: "steps",
    funnelOrderType: "ordered",
    funnelWindowInterval: 14,
    funnelWindowIntervalUnit: "day",
  };
  const steps = {
    kind: "FunnelsQuery",
    series: [
      { kind: "EventsNode", event: "Application Installed", custom_name: "Installiert" },
      { kind: "EventsNode", event: "iap_paywall_viewed", custom_name: "Paywall gesehen", properties: [prop("pro", ["true"], "is_not")] },
      { kind: "EventsNode", event: "iap_purchase_start", custom_name: "Kauf-Klick" },
      {
        kind: "EventsNode",
        event: "iap_purchase_result",
        custom_name: "Trial oder Kauf",
        properties: trialsOnly ? [...PURCHASE_OK, ...FREE_INTRO] : PURCHASE_OK,
      },
    ],
    dateRange: { date_from: `-${days}d` },
    properties: [prop("$app_name", appName, "icontains"), ...(platform ? [prop("$os", OS_NAMES[platform], "exact")] : [])],
    // PostHog's defaults for a new funnel.
    funnelsFilter,
    filterTestAccounts: false,
  };
  if (!trend) return steps;
  return {
    ...steps,
    interval: trend.interval,
    funnelsFilter: { ...funnelsFilter, funnelVizType: "trends", funnelFromStep: trend.from, funnelToStep: trend.to },
  };
}

/** New users per week and build, by the week of their first event (HogQL, values as placeholders). */
const WEEKLY = `
select app, toStartOfWeek(first_seen, 1) as week, build, count() as neu,
  countIf(pw > 0) as paywall, countIf(klick > 0) as klick, countIf(trial > 0) as trials, countIf(trial = 0 and paid > 0) as direkt
from (
  select properties.app as app, person_id, min(timestamp) as first_seen,
    argMin(lower(toString(properties.$os)), timestamp) as os,
    argMin(toString(properties.$app_build), timestamp) as build,
    countIf(event = 'iap_paywall_viewed' and coalesce(properties.pro, false) != true) as pw,
    countIf(event = 'iap_purchase_start') as klick,
    countIf(event = 'iap_purchase_result' and properties.result = 'ok' and coalesce(properties.sandbox, false) != true
      and match(toString(properties.intro), '[0-9]') and not match(toString(properties.intro), '[1-9]')) as trial,
    countIf(event = 'iap_purchase_result' and properties.result = 'ok' and coalesce(properties.sandbox, false) != true) as paid
  from events
  where properties.app = {app} and timestamp >= toDateTime({scan_from})
  group by app, person_id
)
where first_seen >= toDateTime({since}) %PLATFORM%
group by app, week, build
order by app, week, build`;

export interface Conversion {
  funnel: Funnel;
  /** The four rates of TREND_STEPS over twelve weeks. */
  trends: TrendPoint[][];
  rows: FunnelRow[];
  /** When PostHog was asked, for the "Stand" line. */
  at: number;
}

export type ConversionResult = { ok: true; conversion: Conversion } | { ok: false; error: string };

const conversionCache = new Map<string, { at: number; result: ConversionResult }>();

/** One app's conversion. Never throws; errors are not cached, so a fixed key shows at once. */
export async function fetchConversion(
  app: PosthogApp,
  days: number,
  interval: Interval,
  platform: Platform | null,
  since: string,
): Promise<ConversionResult> {
  const key = [app.slug, days, interval, platform ?? "", since].join(":");
  const hit = conversionCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;
  const routing = await getForProxy(POSTHOG_SECRET_ID, { touch: false, cached: true });
  if (!routing) return { ok: false, error: "Kein PostHog-Key im Vault (Eintrag „Posthog Personal Key“ fehlt, ist widerrufen oder hat keine Base-URL)." };
  const name = app.appName ?? app.label;
  const raw = (q: Record<string, unknown>) => runQuery(routing, q) as Promise<unknown>;
  try {
    const scanFrom = new Date(`${since}T00:00:00Z`);
    scanFrom.setUTCDate(scanFrom.getUTCDate() - 120);
    const values: Record<string, unknown> = { app: app.slug, scan_from: `${scanFrom.toISOString().slice(0, 10)} 00:00:00`, since: `${since} 00:00:00` };
    if (platform) values.oses = OS_NAMES[platform].map((o) => o.toLowerCase());
    // All seven at once, as App-Nutzung does with its eight; they waited in four rounds before (2026-11-16).
    const trend = (i: number) => raw(funnelQuery(name, TREND_DAYS, platform, false, { ...TREND_STEPS[i], interval })).then(trendPoints);
    const [all, trials, t0, t1, t2, t3, weekly] = await Promise.all([
      raw(funnelQuery(name, days, platform, false)),
      raw(funnelQuery(name, days, platform, true)),
      trend(0),
      trend(1),
      trend(2),
      trend(3),
      raw({ kind: "HogQLQuery", query: WEEKLY.replace("%PLATFORM%", platform ? "and os in {oses}" : ""), values }),
    ]);
    const rows: FunnelRow[] = (Array.isArray(weekly) ? (weekly as unknown[][]) : []).map(([a, week, build, neu, paywall, klick, tr, direkt]) => ({
      app: String(a),
      week: String(week).slice(0, 10),
      build: build ? String(build) : "?",
      neu: Number(neu),
      paywall: Number(paywall),
      klick: Number(klick),
      trials: Number(tr),
      direkt: Number(direkt),
    }));
    const result: ConversionResult = {
      ok: true,
      conversion: { funnel: { counts: stepCounts(all), trials: stepCounts(trials)[3] ?? 0 }, trends: [t0, t1, t2, t3], rows, at: Date.now() },
    };
    conversionCache.set(key, { at: Date.now(), result });
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
