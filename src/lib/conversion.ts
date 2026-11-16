// The funnel of an app's new users, as PostHog sees it (Alain, 2026-11-16: "Conversionrate, to
// Paywall, Klicke auf kaufen und Trials", in Klar Control): who opened the app for the first time in a week, and how
// many of them then saw the paywall, tapped buy, started a free trial or bought without one. Pure,
// shared by the server and the tests; the PostHog calls are in posthog.ts. Ported from the OurApps
// dashboard (OurApps-LLC/ourapps-dashboard PR #19 to #21).

/** One line of the PostHog answer: the new users of one app, first seen in one week on one build. */
export type FunnelRow = { app: string; week: string; build: string } & Steps;
export type Steps = { neu: number; paywall: number; klick: number; trials: number; direkt: number };

export const PLATFORMS = { ios: "iOS", android: "Android" } as const;
export type Platform = keyof typeof PLATFORMS;
export const isPlatform = (value: unknown): value is Platform => Object.hasOwn(PLATFORMS, value as string);

/** Eight weeks: long enough to see a build come and go, short enough to read at a glance. */
export const WEEKS = 8;
/** A build with fewer new users than this says nothing yet and stays out of the build table. */
export const MIN_BUILD_USERS = 5;

const ZERO: Steps = { neu: 0, paywall: 0, klick: 0, trials: 0, direkt: 0 };
const add = (a: Steps, b: Steps): Steps => ({
  neu: a.neu + b.neu,
  paywall: a.paywall + b.paywall,
  klick: a.klick + b.klick,
  trials: a.trials + b.trials,
  direkt: a.direkt + b.direkt,
});

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The Monday (UTC, as PostHog's toStartOfWeek(…, 1) in a UTC project) of the week that holds `d`. */
export function weekOf(d: Date): string {
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return day(monday);
}

/** The last `n` weeks, oldest first, ending with the running one. */
export function lastWeeks(now: Date, n = WEEKS): string[] {
  const start = new Date(`${weekOf(now)}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const w = new Date(start);
    w.setUTCDate(w.getUTCDate() - 7 * (n - 1 - i));
    return day(w);
  });
}

export type AppFunnel = { weeks: { week: string; steps: Steps }[]; builds: { build: string; steps: Steps }[] };

/** One app's rows per week (every week of `weeks`, empty ones as zeros) and per build (newest first). */
export function summarize(rows: FunnelRow[], app: string, weeks: string[]): AppFunnel {
  const own = rows.filter((r) => r.app === app && weeks.includes(r.week));
  const perWeek = new Map(weeks.map((w) => [w, ZERO]));
  const perBuild = new Map<string, Steps>();
  for (const r of own) {
    perWeek.set(r.week, add(perWeek.get(r.week) ?? ZERO, r));
    perBuild.set(r.build, add(perBuild.get(r.build) ?? ZERO, r));
  }
  return {
    weeks: weeks.map((week) => ({ week, steps: perWeek.get(week) ?? ZERO })),
    builds: [...perBuild.entries()]
      .filter(([, s]) => s.neu >= MIN_BUILD_USERS)
      .sort(([a], [b]) => (Number(b) || 0) - (Number(a) || 0) || b.localeCompare(a))
      .map(([build, steps]) => ({ build, steps })),
  };
}

/** PostHog's funnel (Alain, 2026-11-16: "genau gleich ersichtlich wie bei Posthog"), its four steps in order. */
export const FUNNEL_STEPS = ["Installiert", "Paywall gesehen", "Kauf-Klick", "Trial oder Kauf"] as const;
/** Persons per step as PostHog counts them, and of the last step those whose purchase was a free trial. */
export type Funnel = { counts: number[]; trials: number };

/** The time ranges to choose from, in days; PostHog's funnel counts who installed within it. */
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = 30;
export const rangeOf = (value: unknown): Range => RANGES.find((r) => String(r) === value) ?? DEFAULT_RANGE;

/** The step counts of a FunnelsQuery answer (steps view, no breakdown), in step order. */
export function stepCounts(results: unknown): number[] {
  if (!Array.isArray(results)) return [];
  return results
    .filter((s): s is { order: number; count: number } => typeof s?.order === "number" && typeof s?.count === "number")
    .sort((a, b) => a.order - b.order)
    .map((s) => s.count);
}

export type Bar = { count: number; ofFirst: number | null; ofPrev: number | null; dropped: number; droppedOfFirst: number | null };

/** What each bar shows: its share of step 1 (the height), of the step before, and who dropped off since. */
export function funnelBars(counts: number[]): Bar[] {
  const first = counts[0] ?? 0;
  return counts.map((count, i) => {
    const prev = i === 0 ? count : counts[i - 1];
    return { count, ofFirst: share(count, first), ofPrev: i === 0 ? null : share(count, prev), dropped: Math.max(0, prev - count), droppedOfFirst: share(Math.max(0, prev - count), first) };
  });
}

/** The four rates over time, each between two steps of FUNNEL_STEPS (PostHog's funnel trends). */
export const TREND_STEPS = [
  { label: "Zur Paywall", from: 0, to: 1 },
  { label: "Kauf-Klick", from: 1, to: 2 },
  { label: "Kauf nach Klick", from: 2, to: 3 },
  { label: "Gesamt-Conversion", from: 0, to: 3 },
] as const;
/** One point of a rate over time: the bucket's first day, the rate in percent, and the people behind it. */
export type TrendPoint = { day: string; rate: number; reached: number; of: number };

export const INTERVALS = { week: "pro Woche", day: "pro Tag" } as const;
export type Interval = keyof typeof INTERVALS;
export const intervalOf = (value: unknown): Interval => (value === "day" ? "day" : "week");
/** How far back the graphs reach: twelve weeks, in either interval. */
export const TREND_DAYS = 84;

/** The points of a funnel-trends answer; anything malformed is left out. */
export function trendPoints(results: unknown): TrendPoint[] {
  const r = Array.isArray(results) ? (results[0] as Record<string, unknown> | undefined) : undefined;
  const days = Array.isArray(r?.days) ? (r.days as unknown[]) : [];
  const data = Array.isArray(r?.data) ? (r.data as unknown[]) : [];
  const to = Array.isArray(r?.reached_to_step_count) ? (r.reached_to_step_count as unknown[]) : [];
  const from = Array.isArray(r?.reached_from_step_count) ? (r.reached_from_step_count as unknown[]) : [];
  return days.flatMap((d, i) =>
    typeof d === "string" && typeof data[i] === "number" ? [{ day: d.slice(0, 10), rate: data[i] as number, reached: Number(to[i]) || 0, of: Number(from[i]) || 0 }] : [],
  );
}

/**
 * Where a change sits on a graph of these points, from 0 (first point) to 1 (last point): inside the
 * bucket it falls into, by its day. Null outside the graph.
 */
export function markAt(day: string, points: { day: string }[], interval: Interval): number | null {
  if (points.length < 2) return null;
  const t = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
  const span = interval === "week" ? 7 * 86_400_000 : 86_400_000;
  const at = t(day);
  const first = t(points[0].day);
  const end = t(points[points.length - 1].day) + span;
  if (Number.isNaN(at) || at < first || at >= end) return null;
  // Bucket i spans [day_i, day_i + span) and is drawn at i; a change at its start sits on i, one later
  // in the last bucket stays on the graph's edge.
  return Math.min(1, (at - first) / span / (points.length - 1));
}

/** A change as typed: a real day, not in the future, and one line of 1 to 200 characters. */
export function parseChange(day: string, text: string, today: string): { day: string; text: string } | { error: string } {
  const d = day.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d) {
    return { error: "Ein Tag wie 2026-11-14." };
  }
  if (d > today) return { error: "Der Tag liegt in der Zukunft." };
  const t = text.trim();
  if (!t || t.length > 200 || /\p{C}/u.test(t)) return { error: "Ein Satz, eine Zeile, höchstens 200 Zeichen." };
  return { day: d, text: t };
}

/** A share, or null when there is nothing to divide by (shown as a dash, never as 0 %). */
export const share = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

/** "3,5 %", as Alain writes it; whole numbers from 10 % up. */
export function formatShare(value: number | null): string {
  if (value === null) return "–";
  const p = value * 100;
  return `${p.toLocaleString("de-DE", { maximumFractionDigits: p >= 10 ? 0 : 1 })} %`;
}
