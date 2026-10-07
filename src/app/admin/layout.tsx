// Shared admin chrome. Everything that is identical on every /admin page lives
// here ONCE and persists across client-side menu switches: the big STYLE
// constant and the theme init/toggle scripts. The fonts come from next/font in
// app/layout.tsx.
// Previously each page re-injected the multi-KB inline <style> on every menu
// switch, which is what made navigation flicker/feel slow (and forced SPA view
// transitions to be disabled). Hoisting it here means a menu switch only swaps
// the page content, not the whole stylesheet. Pages now render only <title> +
// their own content (and any page-specific extra <style>, e.g. settings).

import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, normalizeAdminLang } from "./_i18n";
import { NAV_COOKIE, parseNavPrefs } from "./_nav";
import { countOpenCollabs } from "@/lib/collabView";
import { STYLE, THEME_INIT_SCRIPT, THEME_TOGGLE_SCRIPT } from "./_shared";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // UI language for the whole workspace, read once here and handed down.
  const jar = await cookies();
  const lang = normalizeAdminLang(jar.get(LANG_COOKIE)?.value);
  // Menu order + hidden entries, so the first paint is already the admin's.
  const navPrefs = parseNavPrefs(jar.get(NAV_COOKIE)?.value);
  // Sidebar badge. Cached for a minute inside countOpenCollabs, so it does not
  // add a PostgREST round-trip to every single admin navigation.
  const collabOpen = await countOpenCollabs();
  // Ob die Schiene ein- oder ausgeklappt war. shadcn schreibt diese Cookie
  // beim Umschalten; ohne sie hier klappt die Schiene beim ersten Bild kurz
  // auf und dann wieder zu.
  const sidebarOpen = jar.get("sidebar_state")?.value !== "false";
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_TOGGLE_SCRIPT }} />
      <AdminShell lang={lang} collabOpen={collabOpen} navPrefs={navPrefs} sidebarOpen={sidebarOpen}>
        {children}
      </AdminShell>
    </>
  );
}
