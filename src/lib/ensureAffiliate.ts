// Idempotent "make sure a klar_affiliates row exists for this user" helper.
// Called from two places:
//   1. /dashboard/auth/callback after the email-confirm / magic-link OTP
//      gets exchanged for a session.
//   2. /dashboard page-load — for the case where an existing auth.users
//      row (e.g. a legacy Anime-Vault account) signs in with a password
//      and never goes through the callback route.
//
// Walks every wired app-supabase by email, collects matching influencer
// rows, and upserts a klar_affiliates row with the discovered apps[] +
// handles{}. Safe to call repeatedly: ON CONFLICT user_id we merge.

import { serviceSupabase } from "@/lib/supabaseAuth";
import { getApps, sbGet } from "@/lib/adminApps";

export async function ensureAffiliate(userId: string, email: string): Promise<void> {
  if (!email) return;
  const lower = email.trim().toLowerCase();
  if (!lower) return;

  const svc = serviceSupabase();

  // Skip if the row already exists and looks fresh enough. We treat
  // "exists at all" as fresh enough for now — re-running the app-lookup
  // on every page-load would be wasteful. If a new app gets onboarded
  // for an existing affiliate, we'll add a refresh trigger then.
  const { data: existing } = await svc
    .from("klar_affiliates")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;

  // Parallel email-lookup across every wired app supabase.
  const apps = getApps();
  const hits: Array<{ slug: string; handle: string; display_name: string | null }> = [];
  await Promise.all(
    apps.map(async (app) => {
      try {
        const rows = await sbGet(
          app,
          `influencers?contact_email=eq.${encodeURIComponent(lower)}&select=handle,display_name&limit=1`,
        );
        const row = rows[0] as { handle?: string; display_name?: string | null } | undefined;
        if (row?.handle) {
          hits.push({ slug: app.slug, handle: row.handle, display_name: row.display_name ?? null });
        }
      } catch (e) {
        console.warn(`[ensureAffiliate] lookup ${app.slug} failed`, e);
      }
    }),
  );

  const handles: Record<string, string> = {};
  for (const h of hits) handles[h.slug] = h.handle;
  const displayName = hits[0]?.display_name ?? null;

  // Upsert. If the row exists from a parallel race we just bump apps[] +
  // handles{} to the latest snapshot.
  await svc.from("klar_affiliates").upsert(
    {
      user_id: userId,
      email: lower,
      display_name: displayName,
      apps: hits.map((h) => h.slug),
      handles,
    },
    { onConflict: "user_id" },
  );
}
