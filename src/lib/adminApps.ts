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
//
// Optional `revalidate` opt-in (seconds) hands off caching to Next's data
// cache. Default stays no-store so admin pages that need fresh state after a
// POST (dispatch, reconcile, mint) keep seeing reality. Read-only dashboards
// can pass revalidate: 30 to dedupe across tab-switches.
export async function sbGet(
  app: AdminApp,
  path: string,
  opts?: { revalidate?: number },
): Promise<any[]> {
  const cacheOpts =
    opts && typeof opts.revalidate === "number"
      ? { next: { revalidate: opts.revalidate } }
      : { cache: "no-store" as const };
  try {
    const res = await fetch(`${app.supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: app.serviceKey,
        Authorization: `Bearer ${app.serviceKey}`,
        Accept: "application/json",
      },
      ...cacheOpts,
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

// Shape map: which apps use Shape B (influencer_codes table) vs Shape A
// (referrals.influencer_handle direct). See AFFILIATE-ARCHITECTURE.md.
const SHAPE_B_APPS = new Set(["yarn-stash", "kelva", "moto"]);

export interface InfluencerRow {
  id: string;
  handle: string;
  display_name: string | null;
  contact_email: string | null;
  status: string;
  payout_method: string | null;
  payout_email: string | null;
  payout_iban: string | null;
  share_pct: number | null;
  share_months: number | null;
  share_percent: number | null;   // older schema field (Wavelength etc)
  promo_code: string | null;
  country: string | null;
  language: string | null;
  setup_token: string | null;
  setup_token_expires_at: string | null;
  tax_status: string | null;
  created_at: string;
  updated_at: string | null;
}

/** List influencers in an app's Supabase. service-role bypasses RLS. */
export async function listInfluencers(app: AdminApp): Promise<InfluencerRow[]> {
  try {
    const res = await fetch(
      `${app.supabaseUrl}/rest/v1/influencers?select=*&order=created_at.desc&limit=500`,
      {
        headers: {
          apikey: app.serviceKey,
          Authorization: `Bearer ${app.serviceKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    return (await res.json()) as InfluencerRow[];
  } catch {
    return [];
  }
}

/**
 * Suspend / reactivate / soft-ban an influencer. Status must be one of the
 * values used by affiliate-ingest's payout-gate (`active` keeps the influencer
 * earning, `suspended`/`banned` mark new events as counts_for_payout=false,
 * existing matured events still pay out for cleanliness).
 *
 * For Shape-B apps the matching influencer_codes row's status is mirrored too
 * so capture_referral / apply_referral_code skip the code at install-time.
 */
export async function setInfluencerStatus(
  app: AdminApp,
  handle: string,
  newStatus: "active" | "suspended" | "banned" | "paused",
): Promise<{ ok: boolean; error?: string }> {
  // 1) influencers.status — present in every app
  const r1 = await fetch(
    `${app.supabaseUrl}/rest/v1/influencers?handle=eq.${encodeURIComponent(handle)}`,
    {
      method: "PATCH",
      headers: {
        apikey: app.serviceKey,
        Authorization: `Bearer ${app.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: newStatus }),
    },
  );
  if (!r1.ok) {
    const text = await r1.text().catch(() => "");
    return { ok: false, error: `influencers ${r1.status}: ${text.slice(0, 200)}` };
  }
  // 2) Shape B: mirror to influencer_codes.status. PostgREST returns 200 with
  // zero rows if no matching codes exist — no error.
  if (SHAPE_B_APPS.has(app.slug)) {
    const codeStatus = newStatus === "active" ? "active" : "inactive";
    const r2 = await fetch(
      `${app.supabaseUrl}/rest/v1/influencer_codes?handle=eq.${encodeURIComponent(handle)}`,
      {
        method: "PATCH",
        headers: {
          apikey: app.serviceKey,
          Authorization: `Bearer ${app.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: codeStatus }),
      },
    );
    // Don't fail the whole call if codes-table is missing/different schema —
    // the influencers.status flip is the authoritative payout gate.
    if (!r2.ok) {
      const text = await r2.text().catch(() => "");
      console.warn(`[setInfluencerStatus] codes mirror failed ${r2.status}: ${text.slice(0, 200)}`);
    }
  }
  return { ok: true };
}

/** Hard delete an influencer. Use only for test rows; production should
 * `setInfluencerStatus('banned')` instead so existing referrals + payout
 * history stay intact. */
export async function hardDeleteInfluencer(
  app: AdminApp,
  handle: string,
): Promise<{ ok: boolean; error?: string }> {
  // Foreign-keys point to influencers from referral_revenue_events,
  // referrals, influencer_payout_items, influencer_codes. PostgREST DELETE
  // will fail if any of them exist; that's OK, we tell the admin.
  if (SHAPE_B_APPS.has(app.slug)) {
    // delete codes first (cascade-source for some shapes)
    await fetch(
      `${app.supabaseUrl}/rest/v1/influencer_codes?handle=eq.${encodeURIComponent(handle)}`,
      {
        method: "DELETE",
        headers: { apikey: app.serviceKey, Authorization: `Bearer ${app.serviceKey}` },
      },
    ).catch(() => undefined);
  }
  const res = await fetch(
    `${app.supabaseUrl}/rest/v1/influencers?handle=eq.${encodeURIComponent(handle)}`,
    {
      method: "DELETE",
      headers: { apikey: app.serviceKey, Authorization: `Bearer ${app.serviceKey}` },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `delete ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
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

// Canonical landing-page-host per app for the setup-token link. All
// affiliate-onboarding pages now live on getklar.org under
// `affiliate/<slug>/<token>`, regardless of whether the app has its own
// sister-web-repo or not. The sister-web-repos (kelva.space, trubel.space,
// onwavelength.space, myloo.org) keep their tracking-landing routes
// (`/i/<handle>`, `/r/<code>`) but the affiliate onboarding is consolidated
// to klar so there's only one onboarding-shell to maintain.
const FALLBACK_HOSTS: Record<string, string> = {
  trubel: "https://getklar.org/affiliate/trubel",
  myloo: "https://getklar.org/affiliate/myloo",
  wavelength: "https://getklar.org/affiliate/wavelength",
  kelva: "https://getklar.org/affiliate/kelva",
  "yarn-stash": "https://getklar.org/affiliate/yarnstash",
  moto: "https://getklar.org/affiliate/throttleup",
};

export function setupLandingUrl(appSlug: string, token: string): string {
  const envHost = process.env[`KLAR_APP_HOST_${appSlug.toUpperCase().replace(/-/g, "_")}`];
  const host = envHost || FALLBACK_HOSTS[appSlug] || "https://getklar.org";
  // Klar-hosted onboarding paths already encode the per-app subpath, just
  // append the token. The env-override branch keeps the old per-domain
  // shape for emergency rollback (set KLAR_APP_HOST_TRUBEL=https://trubel.space
  // to fall back to the sister-repo route if needed).
  if (host.startsWith("https://getklar.org/affiliate/")) {
    return `${host}/${encodeURIComponent(token)}`;
  }
  return `${host}/affiliate/${encodeURIComponent(token)}`;
}
