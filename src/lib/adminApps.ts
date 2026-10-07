// SERVER ONLY. Registry of the app backends Klar Control reads user numbers
// from (analytics, silent apps on the overview, the app-metrics cron).
//
// Config via env KLAR_ADMIN_APPS = JSON array, one entry per connected app:
//   [{
//     "slug":"wavelength","name":"Basalt",   // shown only for slugs KLAR_APPS does not know
//     "supabaseUrl":"https://yxhzwzgnbmpjztkvdudr.supabase.co",
//     "serviceKey":"<secret key>"
//   }]
// Only these four fields are read; older entries may still carry the
// affiliate-era `functionsBase` and `adminKey`, which are ignored since
// 2026-10-07. Adding an app = add one entry (its Supabase needs the
// `klar_app_stats()` RPC). Never import this into a client component.

import { LISTED_APPS, appBackendKey, findKlarApp } from "./klarApps";

export interface AdminApp {
  slug: string;
  name: string;
  supabaseUrl: string;
  serviceKey: string;
}

// promillio's Supabase project (cmhxvhmxansithjjajld) was recycled to
// Expo-Anime-Vault on 2026-06-30, so the numbers this backend reports belong
// to AnimeVault now. The entry stays connected under its historical slug
// (metrics history, routes, env keys unchanged); getApps() hands it out under
// the brand name.

function readEnvApps(): AdminApp[] {
  try {
    const arr = JSON.parse(process.env.KLAR_ADMIN_APPS ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((a) => a && a.slug && a.name && a.supabaseUrl && a.serviceKey)
      .map((a) => ({
        slug: String(a.slug),
        name: String(a.name),
        supabaseUrl: String(a.supabaseUrl),
        serviceKey: String(a.serviceKey),
      }));
  } catch {
    return [];
  }
}

// The env var is sensitive (unreadable once set) and was hand-written, so its
// `name` field drifted: the promillio slot said "Promillo" while it has served
// Anime Vault since 2026-06-30. The brand name comes from KLAR_APPS instead.
// A slug that only unlisted apps claim (Trubel, ThrottleUp: backends deleted
// or handed over) is dropped, so no page waits on or shows a dead backend.
// A slug KLAR_APPS does not know at all stays, with its env name.
function brandFor(slug: string): { name: string } | null | undefined {
  const listed = LISTED_APPS.find((a) => appBackendKey(a) === slug || a.slug === slug);
  if (listed) return { name: listed.name };
  return findKlarApp(slug) ? null : undefined;
}

export function getApps(): AdminApp[] {
  const out: AdminApp[] = [];
  for (const a of readEnvApps()) {
    const brand = brandFor(a.slug);
    if (brand === null) continue;
    out.push(brand ? { ...a, name: brand.name } : a);
  }
  return out;
}

// Aggregate user stats for one connected app, read from auth.users via the
// `klar_app_stats()` RPC (SECURITY DEFINER, service_role-only) that lives in
// each app's Supabase. auth.users isn't reachable over plain PostgREST, hence
// the RPC. Returns null on any failure (RPC missing, network) so the dashboard
// shows "—" instead of throwing.
export interface AppUserStats {
  usersTotal: number;
  usersNew30d: number;
  usersNew7d: number;
  usersActive30d: number;
}

export async function fetchAppUserStats(
  app: AdminApp,
): Promise<AppUserStats | null> {
  try {
    const res = await fetch(`${app.supabaseUrl}/rest/v1/rpc/klar_app_stats`, {
      method: "POST",
      headers: {
        apikey: app.serviceKey,
        Authorization: `Bearer ${app.serviceKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      // 60s revalidate: user counts are a dashboard figure, not realtime.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    // Scalar jsonb-returning function → PostgREST returns the object directly.
    const j = await res.json();
    if (!j || typeof j !== "object") return null;
    return {
      usersTotal: Number(j.users_total ?? 0),
      usersNew30d: Number(j.users_new_30d ?? 0),
      usersNew7d: Number(j.users_new_7d ?? 0),
      usersActive30d: Number(j.users_active_30d ?? 0),
    };
  } catch {
    return null;
  }
}
