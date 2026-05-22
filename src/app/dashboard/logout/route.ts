// POST /dashboard/logout: terminate the Supabase session + clear cookies +
// bounce the user back to the public landing. Accepts only POST to avoid
// drive-by GET CSRF (a misclicked link can't log you out).

import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const sb = await serverSupabase();
  if (sb) {
    await sb.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
