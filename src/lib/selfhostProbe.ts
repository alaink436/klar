// SERVER ONLY. Liveness + usage probe for the self-host scraper service
// (separate VPS daemon, see ../../../klar-scraper). Reads GET <URL>/healthz and
// GET <URL>/usage with a bearer token. Never throws: on missing env / timeout /
// non-200 it returns { reachable:false, note } so the Scrape-Einstellungen tab
// renders regardless. Endpoints live in env (URL + token are secrets), not in
// the klar_scrape_settings table.
import "server-only";

export interface SelfhostProbe {
  reachable: boolean;
  latencyMs: number | null;
  gbUsed: number | null; // residential proxy GB this month (from /usage)
  estCostUsd: number | null; // estimated proxy cost this month (from /usage)
  version: string | null;
  note: string | null; // human-readable status when not fully reachable
}

const TIMEOUT_MS = 3000;

function base(): SelfhostProbe {
  return { reachable: false, latencyMs: null, gbUsed: null, estCostUsd: null, version: null, note: null };
}

export async function probeSelfhost(): Promise<SelfhostProbe> {
  const url = (process.env.SELFHOST_SCRAPER_URL ?? "").replace(/\/+$/, "");
  const token = process.env.SELFHOST_SCRAPER_TOKEN ?? "";
  if (!url) return { ...base(), note: "SELFHOST_SCRAPER_URL nicht gesetzt" };
  const auth: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  const started = Date.now();
  try {
    const health = await fetch(`${url}/healthz`, {
      headers: auth, // harmless if /healthz is public; required if it is bearer-gated
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    if (!health.ok) return { ...base(), latencyMs, note: `health ${health.status}` };
    const hj = (await health.json().catch(() => null)) as
      | { version?: string; proxy?: string }
      | null;

    // Usage is best-effort; missing it shouldn't flip "reachable" to false.
    let gbUsed: number | null = null;
    let estCostUsd: number | null = null;
    try {
      const usage = await fetch(`${url}/usage`, {
        headers: auth,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (usage.ok) {
        const uj = (await usage.json()) as { month?: { gb?: number; estCostUsd?: number } };
        gbUsed = uj?.month?.gb ?? null;
        estCostUsd = uj?.month?.estCostUsd ?? null;
      }
    } catch {
      /* usage optional */
    }

    return {
      reachable: true,
      latencyMs,
      gbUsed,
      estCostUsd,
      version: hj?.version ?? null,
      note: hj?.proxy === "missing" ? "Proxy nicht konfiguriert" : null,
    };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { ...base(), latencyMs: Date.now() - started, note: name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}
