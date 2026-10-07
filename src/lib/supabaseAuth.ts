// Supabase Auth client factories for the AI-Brain member login (/brain) and
// the brain invites in Klar Control. All auth state lives in the Klar hub
// (anime-vault, project exiuwektrqxvycclqfdd).
//
// Two flavours:
//   - `serverSupabase()`  → server-component / route-handler client that
//                            reads cookies via next/headers and writes
//                            back via cookies().set().
//   - `serviceSupabase()` → server-side admin client with the service-role
//                            key, for look-ups that bypass RLS.
// The browser client (app/brain/_shared) reads NEXT_PUBLIC_* itself.
//
// Env required:
//   NEXT_PUBLIC_KLAR_INBOX_SUPABASE_URL   = https://exiuwektrqxvycclqfdd.supabase.co
//   NEXT_PUBLIC_KLAR_INBOX_ANON_KEY       = <anon JWT>
//   KLAR_INBOX_SERVICE_KEY                = <service-role JWT>   (server-only)

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_KLAR_INBOX_SUPABASE_URL
  ?? process.env.KLAR_INBOX_SUPABASE_URL
  ?? "https://exiuwektrqxvycclqfdd.supabase.co";

const ANON = process.env.NEXT_PUBLIC_KLAR_INBOX_ANON_KEY ?? "";
const SERVICE = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

export async function serverSupabase() {
  // Bail out early if the anon-key is not configured rather than letting
  // createServerClient throw a generic "URL and Key required" error deep
  // inside a render. Callers should handle the null and surface a
  // service-unavailable state.
  if (!ANON) return null;
  // Next 15 made cookies() async, we await it once and pass the store in.
  // The SSR cookie adapter only needs get + set + remove; readonly contexts
  // (server-component render path) throw on set, which we swallow.
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          store.set({ name, value, ...options });
        } catch {
          /* read-only context */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          store.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          /* read-only context */
        }
      },
    },
  });
}

export function serviceSupabase() {
  if (!SERVICE) {
    throw new Error("KLAR_INBOX_SERVICE_KEY env missing");
  }
  return createSupabaseClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Convenience: full user-record for the /brain pages, null if not signed in.
export async function getSessionUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  const sb = await serverSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

// True if both anon + service-role keys are configured. Lets pages render
// a "configure env" notice instead of a 500.
export function isSupabaseConfigured(): boolean {
  return Boolean(ANON && SERVICE);
}
