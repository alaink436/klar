// Handles the redirect from a Supabase Auth email link (confirm-signup +
// magic-link share this route). We exchange the `code` query param for a
// real session, fire the link-affiliate hook so klar_affiliates row gets
// created/updated from the influencers tables across the 6 apps, then
// redirect to /dashboard.

import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabaseAuth";
import { getApps, sbGet } from "@/lib/adminApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirectTo = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/login?error=missing_code", req.url));
  }

  const sb = await serverSupabase();
  if (!sb) {
    return NextResponse.redirect(new URL("/dashboard/login?error=auth_unconfigured", req.url));
  }
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(new URL(`/dashboard/login?error=${encodeURIComponent(error?.message ?? "exchange_failed")}`, req.url));
  }

  // Best-effort: link the auth.users row to klar_affiliates by walking the
  // 6 app supabases and collecting any influencer rows that share this
  // email. If the affiliate is not yet onboarded in any app the row stays
  // empty (apps=[]), the dashboard then shows a friendly empty-state.
  const email = (data.user.email ?? "").trim().toLowerCase();
  if (email) {
    void linkAffiliate(data.user.id, email).catch((e) => {
      console.warn("[auth/callback] link-affiliate threw", e);
    });
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}

async function linkAffiliate(userId: string, email: string): Promise<void> {
  const apps = getApps();
  const hits: Array<{ slug: string; handle: string; display_name: string | null }> = [];

  // Parallel email-lookup across all wired app supabases.
  await Promise.all(
    apps.map(async (app) => {
      const rows = await sbGet(
        app,
        `influencers?contact_email=eq.${encodeURIComponent(email)}&select=handle,display_name&limit=1`,
      );
      const row = rows[0] as { handle?: string; display_name?: string | null } | undefined;
      if (row?.handle) {
        hits.push({ slug: app.slug, handle: row.handle, display_name: row.display_name ?? null });
      }
    }),
  );

  const handles: Record<string, string> = {};
  for (const h of hits) handles[h.slug] = h.handle;
  const displayName = hits[0]?.display_name ?? null;

  const svc = serviceSupabase();
  // Upsert klar_affiliates with the discovered apps + handles. ON CONFLICT
  // user_id we merge so a second app linking later just appends to apps[].
  await svc.from("klar_affiliates").upsert(
    {
      user_id: userId,
      email,
      display_name: displayName,
      apps: hits.map((h) => h.slug),
      handles,
    },
    { onConflict: "user_id" },
  );
}
