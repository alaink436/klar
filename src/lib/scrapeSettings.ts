// SERVER ONLY. Singleton scrape-settings row in anime-vault (exiuwektrqxvycclqfdd),
// table `klar_scrape_settings` (migration 0009). Read by the Outreach
// Scrape-Einstellungen tab AND by the n8n Wave-Consumer to pick the backend
// actor + clamp the per-wave profile count. Mirrors the PostgREST + service-role
// pattern in outreachStore.ts (KLAR_INBOX_SERVICE_KEY).
//
// IG self-host is forced to 'apify' on every read and write: the empirical proxy
// test proved Instagram residential returns 429, so a self-host IG choice is
// never honoured (defense-in-depth, also enforced in the UI + the POST route).
import "server-only";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export type ScrapeBackend = "apify" | "selfhost";
export type ProxyProvider = "iproyal" | "dataimpulse" | "none";
// Production scrape path. 'n8n' = /admin/outreach/start fires the n8n webhook
// (legacy, default). 'evomi' = start enqueues candidates + the cron drains
// enrichment in-app (TikTok via Evomi, Instagram via the Apify profile scraper).
export type WaveBackend = "n8n" | "evomi";

export interface ScrapeSettings {
  tiktok_backend: ScrapeBackend;
  instagram_backend: ScrapeBackend; // always "apify" (IG residential is blocked)
  wave_backend: WaveBackend; // which engine runs a "Welle starten"
  max_profiles_per_wave: number; // hard cap, 5..200
  selfhost_enabled: boolean;
  proxy_provider: ProxyProvider;
  updated_at: string | null;
  updated_by: string | null;
}

export const DEFAULT_SCRAPE_SETTINGS: ScrapeSettings = {
  tiktok_backend: "apify",
  instagram_backend: "apify",
  wave_backend: "n8n",
  max_profiles_per_wave: 30,
  selfhost_enabled: false,
  proxy_provider: "none",
  updated_at: null,
  updated_by: null,
};

const PROXY_PROVIDERS: readonly ProxyProvider[] = ["iproyal", "dataimpulse", "none"];

function hdr(): HeadersInit {
  return {
    apikey: KLAR_INBOX_KEY,
    Authorization: `Bearer ${KLAR_INBOX_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function clampMaxProfiles(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_SCRAPE_SETTINGS.max_profiles_per_wave;
  return Math.min(200, Math.max(5, v));
}

// Coerce a raw DB row (or undefined) into a valid ScrapeSettings, forcing the
// invariants (IG always apify, clamped cap, known proxy provider).
function coerce(row: Partial<ScrapeSettings> | undefined): ScrapeSettings {
  if (!row) return { ...DEFAULT_SCRAPE_SETTINGS };
  return {
    tiktok_backend: row.tiktok_backend === "selfhost" ? "selfhost" : "apify",
    instagram_backend: "apify",
    wave_backend: row.wave_backend === "evomi" ? "evomi" : "n8n",
    max_profiles_per_wave: clampMaxProfiles(row.max_profiles_per_wave),
    selfhost_enabled: Boolean(row.selfhost_enabled),
    proxy_provider: PROXY_PROVIDERS.includes(row.proxy_provider as ProxyProvider)
      ? (row.proxy_provider as ProxyProvider)
      : "none",
    updated_at: row.updated_at ?? null,
    updated_by: row.updated_by ?? null,
  };
}

// Fail-soft to defaults so the Scrape tab always renders, even if the table /
// service key is missing.
export async function getScrapeSettings(): Promise<ScrapeSettings> {
  if (!KLAR_INBOX_KEY) return { ...DEFAULT_SCRAPE_SETTINGS };
  try {
    const res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_scrape_settings?id=eq.true&select=*&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return { ...DEFAULT_SCRAPE_SETTINGS };
    const rows = (await res.json()) as Partial<ScrapeSettings>[];
    return coerce(rows[0]);
  } catch {
    return { ...DEFAULT_SCRAPE_SETTINGS };
  }
}

export interface ScrapeSettingsPatch {
  tiktok_backend?: ScrapeBackend;
  instagram_backend?: ScrapeBackend;
  wave_backend?: WaveBackend;
  max_profiles_per_wave?: number;
  selfhost_enabled?: boolean;
  proxy_provider?: ProxyProvider;
  updated_by?: string | null;
}

export async function upsertScrapeSettings(patch: ScrapeSettingsPatch): Promise<ScrapeSettings> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY missing");
  const body: Record<string, unknown> = {
    id: true,
    ...patch,
    instagram_backend: "apify", // invariant: never persist IG self-host
    updated_at: new Date().toISOString(),
  };
  if (patch.max_profiles_per_wave !== undefined) {
    body.max_profiles_per_wave = clampMaxProfiles(patch.max_profiles_per_wave);
  }
  const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_scrape_settings?on_conflict=id`, {
    method: "POST",
    headers: { ...hdr(), Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`scrape-settings upsert ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as Partial<ScrapeSettings>[];
  return coerce(rows[0]);
}
