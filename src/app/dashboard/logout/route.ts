// POST /dashboard/logout: ends the creator's session, back to the front page.

import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const sb = await serverSupabase();
  if (sb) await sb.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
