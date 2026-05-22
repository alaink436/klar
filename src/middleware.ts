// Next middleware that refreshes the Supabase Auth session cookie before
// every request. Without this the JWT in the cookie expires after an hour
// and the dashboard pages would silently start returning "not signed in".
//
// Matches /dashboard/* + /api/affiliate/* — the rest of the site (landing,
// /admin, /affiliate-onboarding, marketing pages) does not use Supabase
// Auth and would just pay the cost of a token refresh for nothing.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const URL =
  process.env.NEXT_PUBLIC_KLAR_INBOX_SUPABASE_URL ??
  process.env.KLAR_INBOX_SUPABASE_URL ??
  "https://exiuwektrqxvycclqfdd.supabase.co";
const ANON = process.env.NEXT_PUBLIC_KLAR_INBOX_ANON_KEY ?? "";

export async function middleware(req: NextRequest) {
  // Forward the path to server components so the sidebar can highlight
  // the active nav item without prop-drilling through every page.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  // No env? Let the request through unchanged. The dashboard pages will
  // render the "service unavailable" state on their own.
  if (!ANON) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const sb = createServerClient(URL, ANON, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // Touching the user triggers the SSR client to silently refresh the JWT
  // if it's near expiry. We don't read it; the side effect is the cookie
  // rotation onto `res`.
  await sb.auth.getUser();

  return res;
}

export const config = {
  // Restrict the cost to routes that actually use auth.
  matcher: ["/dashboard/:path*", "/api/affiliate/:path*"],
};
