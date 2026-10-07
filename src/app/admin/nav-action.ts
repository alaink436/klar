"use server";

// Server action behind both menu editors (sidebar drag, settings list).
// Writes the `klar_nav` cookie server-side so the next render already comes
// back in the new order — and so the client components stay free of direct
// `document.cookie` writes, which the React-Compiler lint rejects.
//
// The incoming ids are filtered against NAV_ITEMS here as well: parseNavPrefs
// guards the read path, this guards the write path.

import { cookies } from "next/headers";
import { NAV_COOKIE, NAV_COOKIE_MAX_AGE, NAV_ITEMS, type NavPrefs } from "./_nav";
import { requireAdminAction } from "@/lib/adminGuard";

export async function setNavPrefs(prefs: NavPrefs): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const known = new Set(NAV_ITEMS.map((i) => i.id));
  const clean = (arr: string[] | undefined): string[] =>
    [...new Set((arr ?? []).filter((id) => known.has(id)))];
  const value: NavPrefs = { order: clean(prefs?.order), hidden: clean(prefs?.hidden) };
  (await cookies()).set(NAV_COOKIE, encodeURIComponent(JSON.stringify(value)), {
    path: "/",
    maxAge: NAV_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return { ok: true };
}
