// Evomi Scraper-API credit balance for the Abrechnung tab.
//
// Reads GET https://api.evomi.com/public/scraper (Evomi Public API):
//   { success, has_access, credits, concurrency, api_key, endpoint_url }
// `credits` = remaining scraper credits (decimal). Auth: `x-apikey` header.
//
// Key resolution mirrors apifyAccount.ts: the Klar vault is the source of truth.
// NOTE: the Public API officially wants the PROFILE API key (my.evomi.com →
// Settings → API), which may differ from the scraper key stored for the wave.
// We try, in order: a vault entry pointing at api.evomi.com (a dedicated public
// key the admin can add later), then the scraper-API entry. A 401 surfaces as
// reason "unauthorized" and the card tells the admin which key to add.
//
// Cached 5 min (next revalidate) — an account KPI, not a live metric.
import "server-only";
import { listSecrets, revealSecret } from "./vault";

const EVOMI_PUBLIC_URL = "https://api.evomi.com/public/scraper";

export interface EvomiAccountStatus {
  ok: boolean;
  reason: "live" | "no-key" | "unauthorized" | "http-error" | "exception";
  credits: number | null;
  concurrency: number | null;
  fetched_at: string;
}

function fallback(reason: EvomiAccountStatus["reason"]): EvomiAccountStatus {
  return { ok: false, reason, credits: null, concurrency: null, fetched_at: new Date().toISOString() };
}

// 5-min key cache (same pattern as getApifyToken) so the 15s admin auto-refresh
// doesn't hit Supabase + AES-decrypt on every render.
let _keyCache: { key: string; at: number } | null = null;
async function getEvomiKey(): Promise<string> {
  if (_keyCache && Date.now() - _keyCache.at < 300_000) return _keyCache.key;
  let key = "";
  try {
    const secrets = await listSecrets();
    const evomi = secrets.filter(
      (s) => !s.revoked_at && (s.provider.toLowerCase() === "evomi" || s.label.toLowerCase().includes("evomi")),
    );
    // Prefer a dedicated public-API entry (base_url on api.evomi.com) over the
    // scraper entry — the admin can add one if the scraper key gets a 401 here.
    const preferred =
      evomi.find((s) => (s.base_url ?? "").includes("api.evomi.com")) ?? evomi[0];
    if (preferred) key = (await revealSecret(preferred.id)) ?? "";
  } catch {
    /* vault unreachable */
  }
  _keyCache = { key, at: Date.now() };
  return key;
}

export async function getEvomiAccountStatus(): Promise<EvomiAccountStatus> {
  const key = await getEvomiKey();
  if (!key) return fallback("no-key");
  try {
    const res = await fetch(EVOMI_PUBLIC_URL, {
      headers: { "x-apikey": key },
      next: { revalidate: 300 },
    });
    if (res.status === 401 || res.status === 403) return fallback("unauthorized");
    if (!res.ok) return fallback("http-error");
    const json = (await res.json()) as {
      success?: boolean;
      has_access?: boolean;
      credits?: number;
      concurrency?: number;
    };
    if (!json?.success || json?.has_access === false) return fallback("http-error");
    return {
      ok: true,
      reason: "live",
      credits: typeof json.credits === "number" ? Math.round(json.credits * 10) / 10 : null,
      concurrency: typeof json.concurrency === "number" ? json.concurrency : null,
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return fallback("exception");
  }
}
