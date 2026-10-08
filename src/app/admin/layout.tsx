// Shared admin chrome. Everything that is identical on every /admin page lives
// here ONCE and persists across client-side menu switches: the design (admin.css),
// the fonts and the theme init script.
// Previously each page re-injected the multi-KB inline <style> on every menu
// switch, which is what made navigation flicker/feel slow (and forced SPA view
// transitions to be disabled). Hoisting it here means a menu switch only swaps
// the page content, not the whole stylesheet. Pages now render only <title> +
// their own content (and any page-specific extra <style>, e.g. settings).

import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { LANG_COOKIE, normalizeAdminLang } from "./_i18n";
import { NAV_COOKIE, parseNavPrefs } from "./_nav";
import { countOpenCollabs } from "@/lib/collabView";
import { THEME_INIT_SCRIPT } from "./_shared";
import AdminShell from "./AdminShell";
import "./admin.css";

// Geist Sans for everything, Geist Mono for numbers and short codes. The
// families are handed to admin.css as variables on :root rather than as a
// class on a wrapper, because dialogs, menus and toasts render into <body>,
// outside any wrapper this layout could draw.
const geist = Geist({ subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap" });
const FONT_VARS = `:root{--font-geist-sans:${geist.style.fontFamily};--font-geist-mono:${geistMono.style.fontFamily}}`;

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
      <style dangerouslySetInnerHTML={{ __html: FONT_VARS }} />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <AdminShell lang={lang} collabOpen={collabOpen} navPrefs={navPrefs} sidebarOpen={sidebarOpen}>
        {children}
      </AdminShell>
    </>
  );
}
