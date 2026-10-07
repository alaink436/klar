"use server";

// Server action behind the sidebar's DE/EN switch. The cookie is written on the
// server so the very next render already comes back in the chosen language —
// and so the client component stays free of direct `document.cookie` writes,
// which the React-Compiler lint rightly rejects.

import { cookies } from "next/headers";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, normalizeAdminLang } from "./_i18n";
import { requireAdminAction } from "@/lib/adminGuard";

export async function setAdminLang(input: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const lang = normalizeAdminLang(input);
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: LANG_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return { ok: true };
}
