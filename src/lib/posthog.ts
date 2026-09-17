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
}

export const POSTHOG_APPS: PosthogApp[] = [
  { slug: "basalt", label: "Basalt", dashboardId: 958868 },
  { slug: "kelva", label: "Kelva", dashboardId: 958869 },
  { slug: "myloo", label: "MyLoo", dashboardId: 958870 },
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
async function runQuery(routing: Routing, source: Record<string, unknown>): Promise<any[]> {
  const url = `${routing.baseUrl.replace(/\/$/, "")}/api/projects/${POSTHOG_PROJECT_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [routing.authHeader || "authorization"]: `${routing.authScheme ?? ""}${routing.key}`,
    },
    body: JSON.stringify({ query: source }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PostHog ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { results?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return Array.isArray(json.results) ? json.results : [];
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
    .map((r: any) => {
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
  const routing = await getForProxy(POSTHOG_SECRET_ID, { touch: false });
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
