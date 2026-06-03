// POST /brain/logout: end the member's Supabase session and bounce to the
// brain login. POST-only so a misclicked link can't sign someone out.

import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const sb = await serverSupabase();
  if (sb) await sb.auth.signOut();
  return NextResponse.redirect(new URL("/brain/login", req.url), { status: 303 });
}
