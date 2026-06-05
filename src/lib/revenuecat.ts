// SERVER ONLY. RevenueCat per-app revenue connector.
//
// The Klar admin shows real app revenue (MRR, 28-day revenue, active subs /
// trials) next to the user counts in /admin/analytics. RevenueCat's REST v2
// "Overview metrics" endpoint is the source — it needs a PROJECT-SCOPED SECRET
// key (`sk_...`), one per app, which only lives in the RevenueCat dashboard.
//
// Config via env KLAR_REVENUECAT_KEYS = JSON array, one entry per app that has
// a RevenueCat project:
//   [{
//     "slug":"yarn-stash",
//     "projectId":"proj1aB2cD3e",
//     "secretKey":"sk_xxxxxxxxxxxxxxxxxxxx"
//   }]
// The `slug` must match the KLAR_APPS slug so the dashboard can line revenue up
// with the right app. Apps without an entry simply render "RevenueCat-Key
// fehlt" — the view degrades gracefully, same pattern as KLAR_ADMIN_APPS.
//
// Never import this into a client component; the secret keys must stay on the
// server.

export interface RcConfig {
  slug: string;
  projectId: string;
  secretKey: string;
}

export function getRcConfigs(): RcConfig[] {
  try {
    const arr = JSON.parse(process.env.KLAR_REVENUECAT_KEYS ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (c) => c && c.slug && c.projectId && c.secretKey,
    );
  } catch {
    return [];
  }
}

export function getRcConfig(slug: string): RcConfig | null {
  return getRcConfigs().find((c) => c.slug === slug) ?? null;
}

// Normalized overview snapshot. Money fields are in RevenueCat's display
// currency (account-level, usually USD) — `currency` carries the unit symbol
// RevenueCat returned so the UI can label it honestly instead of pretending
// it's CHF.
export interface RcOverview {
  mrr: number | null;
  revenue28d: number | null;
  activeSubscriptions: number | null;
  activeTrials: number | null;
  activeUsers28d: number | null;
  newCustomers28d: number | null;
  currency: string; // "$" etc, from the metric unit
  ok: boolean;
}

interface RcMetric {
  id?: string;
  unit?: string;
  value?: number;
}

// Map a metric id -> value out of the overview array. RevenueCat returns each
// metric as { id, unit, value, period }; we pick the ones we surface.
function metric(metrics: RcMetric[], id: string): RcMetric | undefined {
  return metrics.find((m) => m && m.id === id);
}

// Fetch the Overview metrics for one RevenueCat project. Returns null on any
// failure (bad key, network, schema drift) so the dashboard shows "Key fehlt /
// Fehler" rather than throwing. 60s revalidate: revenue is a human-readable
// figure, not a realtime monitor, and RevenueCat's overview itself only
// recomputes periodically.
export async function fetchRcOverview(cfg: RcConfig): Promise<RcOverview | null> {
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(cfg.projectId)}/metrics/overview`,
      {
        headers: {
          Authorization: `Bearer ${cfg.secretKey}`,
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const metrics: RcMetric[] = Array.isArray(j?.metrics) ? j.metrics : [];
    if (metrics.length === 0) return null;

    const mrr = metric(metrics, "mrr");
    const revenue = metric(metrics, "revenue");
    const activeSubs = metric(metrics, "active_subscriptions");
    const activeTrials = metric(metrics, "active_trials");
    const activeUsers = metric(metrics, "active_users");
    const newCustomers = metric(metrics, "new_customers");

    const num = (m: RcMetric | undefined): number | null =>
      m && typeof m.value === "number" ? m.value : null;

    return {
      mrr: num(mrr),
      revenue28d: num(revenue),
      activeSubscriptions: num(activeSubs),
      activeTrials: num(activeTrials),
      activeUsers28d: num(activeUsers),
      newCustomers28d: num(newCustomers),
      currency: mrr?.unit || revenue?.unit || "$",
      ok: true,
    };
  } catch {
    return null;
  }
}
