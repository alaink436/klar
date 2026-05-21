// SERVER ONLY. Multi-app affiliate/payout admin registry.
//
// Config via env KLAR_ADMIN_APPS = JSON array, one entry per connected app:
//   [{
//     "slug":"wavelength","name":"Wavelength",
//     "supabaseUrl":"https://yxhzwzgnbmpjztkvdudr.supabase.co",
//     "serviceKey":"<service-role key>",
//     "functionsBase":"https://yxhzwzgnbmpjztkvdudr.supabase.co/functions/v1",
//     "adminKey":"<x-admin-key for that app's wise-dispatch/reconcile>"
//   }]
// Adding an app later = add one entry (once that app's Supabase has the
// affiliate schema). Never import this into a client component.

export interface AdminApp {
  slug: string;
  name: string;
  supabaseUrl: string;
  serviceKey: string;
  functionsBase: string;
  adminKey: string;
}

export function getApps(): AdminApp[] {
  try {
    const arr = JSON.parse(process.env.KLAR_ADMIN_APPS ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (a) => a && a.slug && a.name && a.supabaseUrl && a.serviceKey,
    );
  } catch {
    return [];
  }
}

export function getApp(slug: string): AdminApp | null {
  return getApps().find((a) => a.slug === slug) ?? null;
}

// PostgREST GET with the service-role key (bypasses RLS). Returns [] on any
// failure so a not-yet-onboarded app degrades gracefully instead of throwing.
export async function sbGet(app: AdminApp, path: string): Promise<any[]> {
  try {
    const res = await fetch(`${app.supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: app.serviceKey,
        Authorization: `Bearer ${app.serviceKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

// PostgREST RPC call with the service-role key. Throws on any non-2xx so the
// caller can show a real error instead of pretending things worked.
export async function sbRpc<T = unknown>(
  app: AdminApp,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${app.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: app.serviceKey,
      Authorization: `Bearer ${app.serviceKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`sbRpc ${fn} ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// Mint a new influencer-code for one of the connected apps. Calls the
// `admin_create_influencer_code` RPC that lives in each app's Supabase
// (added by migrations 0001 [wavelength/yarnstash native] and
// 0002_attribution_for_kelva_moto.sql [generic shape-B]). Returns the new
// influencer_codes row as written.
export interface InfluencerCode {
  id: string;
  code: string;
  handle: string | null;
  display_name: string | null;
  commission_pct: number;
  status: string;
  created_at?: string;
}

export async function mintInfluencerCode(
  app: AdminApp,
  args: {
    code: string;
    handle: string;
    displayName: string;
    commissionPct?: number;
  },
): Promise<InfluencerCode> {
  return await sbRpc<InfluencerCode>(app, "admin_create_influencer_code", {
    p_code: args.code,
    p_display_name: args.displayName,
    p_handle: args.handle,
    p_commission_pct: args.commissionPct ?? 0.5,
  });
}

// Create a one-shot onboarding setup token for an influencer. The token is
// a URL-safe 32-char string with a 7-day TTL; the influencer lands on
// `<app-domain>/affiliate/<token>` and completes their payout-setup. Each
// app's Supabase has the same `create_influencer_setup` RPC (migration
// `influencer_onboarding_v1`).
export interface InfluencerSetupRow {
  id: string;
  handle: string;
  display_name: string | null;
  contact_email: string | null;
  language: string;
  setup_token: string;
  setup_token_expires_at: string;
  share_pct: number;
  share_months: number;
  status: string;
  app: string | null;
}

export async function createInfluencerSetup(
  app: AdminApp,
  args: {
    email: string;
    handle: string;
    displayName?: string;
    language?: string;
    appSlug?: string;
    sharePct?: number;
    shareMonths?: number;
  },
): Promise<InfluencerSetupRow> {
  return await sbRpc<InfluencerSetupRow>(app, "create_influencer_setup", {
    p_email: args.email,
    p_handle: args.handle,
    p_display_name: args.displayName ?? null,
    p_language: args.language ?? "de",
    p_app: args.appSlug ?? null,
    p_share_pct: args.sharePct ?? 50,
    p_share_months: args.shareMonths ?? 24,
  });
}

// Canonical landing-page-host per app for the setup-token link. Apps with
// their own sister-web-repo + domain use `<domain>/affiliate/<token>`.
// Apps without a dedicated web-repo (Yarn-Stash, ThrottleUp) get a Klar
// fallback under `getklar.org/affiliate/<slug>/<token>`.
const FALLBACK_HOSTS: Record<string, string> = {
  trubel: "https://trubel.space",
  myloo: "https://myloo.org",
  wavelength: "https://onwavelength.space",
  kelva: "https://kelva.space",
  "yarn-stash": "https://getklar.org/affiliate/yarnstash",
  moto: "https://getklar.org/affiliate/throttleup",
};

export function setupLandingUrl(appSlug: string, token: string): string {
  const envHost = process.env[`KLAR_APP_HOST_${appSlug.toUpperCase().replace(/-/g, "_")}`];
  const host = envHost || FALLBACK_HOSTS[appSlug] || "https://getklar.org";
  // For per-app domain hosts (trubel/myloo/etc.) use /affiliate/<token>.
  // For the klar-fallback hosts the host already encodes the per-app
  // subpath, just append the token.
  if (host.startsWith("https://getklar.org/affiliate/")) {
    return `${host}/${encodeURIComponent(token)}`;
  }
  return `${host}/affiliate/${encodeURIComponent(token)}`;
}
