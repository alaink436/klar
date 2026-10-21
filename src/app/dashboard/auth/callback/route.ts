// Where the creator's e-mail link lands: exchange the code for a session, then
// on to the dashboard. A dead link goes back to login with a notice.

import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const code = new URL(req.url).searchParams.get("code");
  const sb = code ? await serverSupabase() : null;
  const { error } = sb && code ? await sb.auth.exchangeCodeForSession(code) : { error: true };
  return NextResponse.redirect(new URL(error ? "/dashboard/login?error=link" : "/dashboard", req.url));
}
