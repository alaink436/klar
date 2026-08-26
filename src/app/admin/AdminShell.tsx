"use client";

// Der bleibende Rahmen von Klar Control. Haengt in `admin/layout.tsx`, damit
// Schiene und Inhaltsflaeche EINMAL montiert werden und beim Wechseln des
// Menuepunkts stehen bleiben. Getauscht wird nur der Inhalt (children), das
// ist der Grund, warum die Navigation sofort wirkt.
//
// Seit 2026-08-25 kommt der Rahmen aus `components/ui/sidebar` statt aus zwei
// handgeschriebenen Klassen (`.layout`, `.main`) im STYLE-String. Was das
// zusaetzlich bringt: die Schiene laesst sich auf Symbolbreite einklappen, der
// Zustand haelt sich in der `sidebar_state`-Cookie, und auf schmalen Geraeten
// wird sie zu einer Lade statt zu 240 festen Pixeln.
//
// Login ist die eine /admin-Route ohne Schiene: dort geben wir children blank
// aus. Welcher Eintrag leuchtet, leiten wir aus dem Pfad ab, weil das Layout
// allen Seiten gemeinsam ist.

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import type { AdminLang } from "./_i18n";
import { DEFAULT_NAV_PREFS, type NavPrefs } from "./_nav";

function activeFromPath(path: string): string {
  // /admin/<seg>/... -> "<seg>"; blankes /admin oder /admin/ -> "overview".
  const seg = path.replace(/^\/admin\/?/, "").split("/")[0];
  return seg || "overview";
}

export default function AdminShell({
  apps,
  lang,
  collabOpen,
  navPrefs = DEFAULT_NAV_PREFS,
  sidebarOpen = true,
  children,
}: {
  apps: { slug: string; name: string }[];
  lang: AdminLang;
  collabOpen?: number;
  navPrefs?: NavPrefs;
  /** Aus der `sidebar_state`-Cookie, im Layout gelesen. Ohne diesen Wert
      klappt die Schiene beim ersten Bild kurz auf und dann wieder zu. */
  sidebarOpen?: boolean;
  children: ReactNode;
}) {
  const path = usePathname() || "/admin";

  // Login hat keine Schiene, seine zentrierte Karte steht fuer sich.
  if (path === "/admin/login") return <>{children}</>;

  return (
    <SidebarProvider
      defaultOpen={sidebarOpen}
      // 240px wie vorher, nicht die 256px der Vorgabe: die Zeilenlaengen im
      // Menue sind darauf eingerichtet.
      style={{ "--sidebar-width": "240px" } as React.CSSProperties}
    >
      <AdminSidebar active={activeFromPath(path)} apps={apps} lang={lang} collabOpen={collabOpen} prefs={navPrefs} />
      <SidebarRail />
      <SidebarInset className="main">{children}</SidebarInset>
    </SidebarProvider>
  );
}
