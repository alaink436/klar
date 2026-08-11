"use server";

// Server action behind the sidebar's DE/EN switch. The cookie is written on the
// server so the very next render already comes back in the chosen language —
// and so the client component stays free of direct `document.cookie` writes,
// which the React-Compiler lint rightly rejects.

import { cookies } from "next/headers";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, normalizeAdminLang } from "./_i18n";

export async function setAdminLang(input: string): Promise<void> {
  const lang = normalizeAdminLang(input);
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: LANG_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
