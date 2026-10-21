// Where the creator's e-mail link lands: a session, then on to the dashboard. A
// dead link goes back to login with a notice.
//
// Two kinds of link: `token_hash` (the e-mail templates link here directly,
// verifyOtp works in any browser) and `code` (PKCE: only works in the browser
// that asked for the link, because the code verifier sits in its cookies). On a
// phone people ask inside TikTok's browser and open the mail in Safari, so the
// templates use token_hash; `code` stays for links sent before the switch.

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { serverSupabase } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const sb = code || tokenHash ? await serverSupabase() : null;
  const { error } = !sb
    ? { error: true }
    : tokenHash
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type: (q.get("type") ?? "email") as EmailOtpType })
      : await sb.auth.exchangeCodeForSession(code!);
  return NextResponse.redirect(new URL(error ? "/dashboard/login?error=link" : "/dashboard", req.url));
}
