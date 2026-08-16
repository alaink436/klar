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
