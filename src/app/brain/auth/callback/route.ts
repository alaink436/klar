// Handles the redirect from a Supabase magic-link for AI-Brain members.
// Exchanges the `code` for a session, then confirms an active membership
// before sending the member into the viewer. A signed-in user without an
// active brain_members row is bounced to login with a no_access notice (their
// session is still created, but the gate keeps them out).

import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabaseAuth";
import { getBrainMember } from "@/lib/brainMembers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/brain/login?error=missing_code", req.url));
  }

  const sb = await serverSupabase();
  if (!sb) {
    return NextResponse.redirect(new URL("/brain/login?error=no_access", req.url));
  }
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(new URL("/brain/login?error=no_access", req.url));
  }

  const email = (data.user.email ?? "").trim().toLowerCase();
  const member = email ? await getBrainMember(email) : null;
  if (!member || member.revoked_at) {
    return NextResponse.redirect(new URL("/brain/login?error=no_access", req.url));
  }

  return NextResponse.redirect(new URL("/brain", req.url));
}
