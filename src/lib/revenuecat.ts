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

import { LISTED_APPS, appBackendKey } from "./klarApps";
import { listSecrets, revealSecret } from "./vault";

export interface RcConfig {
  slug: string;
  projectId: string;
  secretKey: string;
}

function readEnvConfigs(): RcConfig[] {
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

// The vault wins over the env var. Until 2026-09-21 the env's `promillio` slot
// held the key of the RevenueCat project "Promillo", while that backend slot
// has stood for Anime Vault since 2026-06-30: a Promillo purchase showed up as
// an Anime Vault subscription. The env var is sensitive, so nobody could see
// that. Vault entries (provider "revenuecat") name their app in the label
// ("Revenuecat Anime Vault", "Revenuecat-YarnStash"), which is matched against
// the brand name or slug of every listed app. The project id comes from the
// key itself (a project-scoped key sees exactly one project).
const norm = (s: string) => s.toLowerCase().replace(/revenuecat/g, "").replace(/[^a-z0-9]/g, "");

async function projectIdFor(secretKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.revenuecat.com/v2/projects", {
      headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const id = Array.isArray(j?.items) ? j.items[0]?.id : null;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

async function readVaultConfigs(): Promise<RcConfig[]> {
  const secrets = (await listSecrets()).filter(
    (s) => !s.revoked_at && s.provider.toLowerCase() === "revenuecat",
  );
  const found = await Promise.all(
    LISTED_APPS.map(async (app): Promise<RcConfig | null> => {
      const names = new Set([norm(app.name), norm(app.slug)]);
      const entry = secrets.find((s) => names.has(norm(s.label)));
      if (!entry) return null;
      const secretKey = await revealSecret(entry.id);
      if (!secretKey) return null;
      const projectId = await projectIdFor(secretKey);
      return projectId ? { slug: appBackendKey(app), projectId, secretKey } : null;
    }),
  );
  return found.filter((c): c is RcConfig => c !== null);
}

// Ten minutes: the vault round-trip is one list plus one decrypt per app, and
// keys do not change between two dashboard clicks.
let _cache: { configs: RcConfig[]; at: number } | null = null;

export async function getRcConfigs(): Promise<RcConfig[]> {
  if (_cache && Date.now() - _cache.at < 600_000) return _cache.configs;
  let vault: RcConfig[] = [];
  try {
    vault = await readVaultConfigs();
  } catch {
    /* vault unreachable: the env entries still stand */
  }
  const bySlug = new Map(readEnvConfigs().map((c) => [c.slug, c]));
  for (const c of vault) bySlug.set(c.slug, c);
  const configs = [...bySlug.values()];
  _cache = { configs, at: Date.now() };
  return configs;
}

export async function getRcConfig(slug: string): Promise<RcConfig | null> {
  return (await getRcConfigs()).find((c) => c.slug === slug) ?? null;
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
