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
