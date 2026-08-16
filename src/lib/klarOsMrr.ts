// SERVER ONLY. The one number the price ladder on the landing page is indexed
// to: what the shipped apps earn per month, right now.
//
// Nothing new is measured here. The daily cron at /api/cron/app-metrics already
// pulls each app's RevenueCat overview and writes it to klar_app_metrics_daily
// in the Klar hub; this reads the newest day back and adds it up. That means the
// page can never invent a figure, and it also means the figure is at most a day
// old, which is the right resolution for a number that moves in months.

const HUB_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export interface AppsMrr {
  /** Summed monthly recurring revenue across every connected app, in cents. */
  cents: number;
  /** Summed active subscriptions across those apps. */
  subscriptions: number;
  /** The day the snapshot was taken (YYYY-MM-DD). */
  day: string;
  /** How many apps reported. */
  apps: number;
}

export async function readAppsMrr(): Promise<AppsMrr | null> {
  if (!HUB_KEY) return null;
  try {
    // Newest snapshot day first, then everything recorded for that day.
    const latest = await fetch(
      `${HUB_URL}/rest/v1/klar_app_metrics_daily?select=day&order=day.desc&limit=1`,
      {
        headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}`, Accept: "application/json" },
        next: { revalidate: 3600 },
      },
    );
    if (!latest.ok) return null;
    const days = (await latest.json()) as { day: string }[];
    const day = days?.[0]?.day;
    if (!day) return null;

    const res = await fetch(
      `${HUB_URL}/rest/v1/klar_app_metrics_daily?select=mrr_cents,active_subscriptions&day=eq.${day}`,
      {
        headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}`, Accept: "application/json" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      mrr_cents: number | null;
      active_subscriptions: number | null;
    }[];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    return {
      cents: rows.reduce((n, r) => n + (r.mrr_cents ?? 0), 0),
      subscriptions: rows.reduce((n, r) => n + (r.active_subscriptions ?? 0), 0),
      day,
      apps: rows.length,
    };
  } catch {
    return null;
  }
}

export interface MrrPoint {
  day: string;
  cents: number;
  subscriptions: number;
}

/**
 * The whole recorded series, oldest first, one point per snapshot day. Same
 * table as readAppsMrr, summed per day across every connected app.
 *
 * Days can be missing: the cron has skipped a night before, and a gap is a gap
 * rather than a zero. Callers must not assume the last two points are
 * consecutive days, which is why the change is labelled with the date it is
 * measured against.
 */
export async function readAppsMrrSeries(): Promise<MrrPoint[]> {
  if (!HUB_KEY) return [];
  try {
    const res = await fetch(
      `${HUB_URL}/rest/v1/klar_app_metrics_daily?select=day,mrr_cents,active_subscriptions&order=day.asc&limit=20000`,
      {
        headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}`, Accept: "application/json" },
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as {
      day: string;
      mrr_cents: number | null;
      active_subscriptions: number | null;
    }[];
    if (!Array.isArray(rows)) return [];

    const byDay = new Map<string, MrrPoint>();
    for (const r of rows) {
      const p = byDay.get(r.day) ?? { day: r.day, cents: 0, subscriptions: 0 };
      p.cents += r.mrr_cents ?? 0;
      p.subscriptions += r.active_subscriptions ?? 0;
      byDay.set(r.day, p);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  } catch {
    return [];
  }
}
