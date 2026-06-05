// SERVER ONLY. Time-series data for the Apps analytics tab.
//
// Two metrics:
//   - users  : real history, derived from each app's auth.users via the
//              klar_app_user_series RPC (new-signups per bucket + a baseline
//              count before the window). The dashboard turns this into a
//              cumulative growth line.
//   - revenue: RevenueCat's API only exposes a current snapshot, so there is no
//              historical revenue series to read back. Instead a daily cron
//              (snapshotAllApps) records each app's MRR/revenue into
//              klar_app_metrics_daily in the Klar-hub Supabase, and the chart
//              reads that table. History therefore builds up from the first
//              snapshot forward.
//
// Never import into a client component.

import { getApps, fetchAppUserStats, type AdminApp } from "./adminApps";
import { getRcConfig, fetchRcOverview } from "./revenuecat";

const HUB_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export type Bucket = "day" | "month";

export interface UserSeries {
  baseline: number; // users created before the window start
  buckets: { b: string; n: number }[]; // new users per bucket key (YYYY-MM-DD / YYYY-MM)
}

// Per-app signup series from the app's own Supabase (klar_app_user_series RPC).
// Returns null on any failure so the chart drops that app gracefully.
export async function fetchAppUserSeries(
  app: AdminApp,
  since: string,
  bucket: Bucket,
): Promise<UserSeries | null> {
  try {
    const res = await fetch(`${app.supabaseUrl}/rest/v1/rpc/klar_app_user_series`, {
      method: "POST",
      headers: {
        apikey: app.serviceKey,
        Authorization: `Bearer ${app.serviceKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ p_since: since, p_bucket: bucket }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || typeof j !== "object") return null;
    const buckets = Array.isArray(j.buckets)
      ? j.buckets.map((x: { b: string; n: number }) => ({ b: String(x.b), n: Number(x.n ?? 0) }))
      : [];
    return { baseline: Number(j.baseline ?? 0), buckets };
  } catch {
    return null;
  }
}

export interface MetricsHistoryRow {
  day: string;
  app_slug: string;
  users_total: number | null;
  mrr_cents: number | null;
  revenue_28d_cents: number | null;
  active_subscriptions: number | null;
  currency: string | null;
}

// Read recorded daily snapshots from the Klar-hub for day >= since.
export async function readMetricsHistory(since: string): Promise<MetricsHistoryRow[]> {
  if (!HUB_KEY) return [];
  try {
    const day = since.slice(0, 10);
    const res = await fetch(
      `${HUB_URL}/rest/v1/klar_app_metrics_daily?select=day,app_slug,users_total,mrr_cents,revenue_28d_cents,active_subscriptions,currency&day=gte.${day}&order=day.asc&limit=10000`,
      {
        headers: {
          apikey: HUB_KEY,
          Authorization: `Bearer ${HUB_KEY}`,
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? (j as MetricsHistoryRow[]) : [];
  } catch {
    return [];
  }
}

export interface SnapshotResult {
  ok: boolean;
  day: string;
  apps: { slug: string; users: number | null; mrrCents: number | null; ok: boolean }[];
  error?: string;
}

// Cron body: snapshot every connected app's users + RevenueCat revenue into
// klar_app_metrics_daily for today (UTC). Upsert on (day, app_slug) so re-runs
// in the same day overwrite with the latest read.
export async function snapshotAllApps(today: string): Promise<SnapshotResult> {
  if (!HUB_KEY) return { ok: false, day: today, apps: [], error: "no_hub_key" };
  const apps = getApps();
  const rows = await Promise.all(
    apps.map(async (app) => {
      const rc = getRcConfig(app.slug);
      const [stats, rcov] = await Promise.all([
        fetchAppUserStats(app),
        rc ? fetchRcOverview(rc) : Promise.resolve(null),
      ]);
      const mrrCents = rcov && rcov.mrr !== null ? Math.round(rcov.mrr * 100) : null;
      const rev28Cents = rcov && rcov.revenue28d !== null ? Math.round(rcov.revenue28d * 100) : null;
      return {
        day: today,
        app_slug: app.slug,
        users_total: stats?.usersTotal ?? null,
        users_new_30d: stats?.usersNew30d ?? null,
        users_active_30d: stats?.usersActive30d ?? null,
        mrr_cents: mrrCents,
        revenue_28d_cents: rev28Cents,
        active_subscriptions: rcov?.activeSubscriptions ?? null,
        active_trials: rcov?.activeTrials ?? null,
        currency: rcov?.currency ?? null,
      };
    }),
  );
  try {
    const res = await fetch(`${HUB_URL}/rest/v1/klar_app_metrics_daily`, {
      method: "POST",
      headers: {
        apikey: HUB_KEY,
        Authorization: `Bearer ${HUB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, day: today, apps: [], error: `upsert ${res.status}: ${t.slice(0, 200)}` };
    }
  } catch (e) {
    return { ok: false, day: today, apps: [], error: String(e).slice(0, 200) };
  }
  return {
    ok: true,
    day: today,
    apps: rows.map((r) => ({
      slug: r.app_slug,
      users: r.users_total,
      mrrCents: r.mrr_cents,
      ok: true,
    })),
  };
}
