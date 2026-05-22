// Handles the redirect from a Supabase Auth email link (confirm-signup +
// magic-link share this route). We exchange the `code` query param for a
// real session, fire the link-affiliate hook so klar_affiliates row gets
// created/updated from the influencers tables across the 6 apps, then
// redirect to /dashboard.

import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabaseAuth";
import { ensureAffiliate } from "@/lib/ensureAffiliate";

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
  // 6 app supabases. Idempotent helper is also called from the dashboard
  // page-load so existing legacy auth.users that sign in with a password
  // never go through this route still get a row.
  const email = (data.user.email ?? "").trim().toLowerCase();
  if (email) {
    void ensureAffiliate(data.user.id, email).catch((e) => {
      console.warn("[auth/callback] ensure-affiliate threw", e);
    });
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
