// Die Leiste ueber dem Seiteninhalt: wo bin ich, und der Weg zur Palette.
//
// Bis 2026-08-25 baute jede der 21 Admin-Seiten diese Leiste selbst als
// HTML-Zeichenkette zusammen und schrieb sie per dangerouslySetInnerHTML in die
// Seite. Zweiundzwanzig Stellen fuer eine Leiste. Hier steht sie einmal.
//
// Seit 2026-10-08 ist Klar Control nur noch dunkel; der Umschalter fuer hell
// und dunkel, der hier stand, ist weg.
//
// Im installierten App-Fenster ist diese Leiste die Fensterleiste: sie weicht
// den Fensterknoepfen aus, und ihre Knoepfe nehmen die Hoehe aus
// --klar-kopf-knopf (admin.css, Abschnitt "App-Fenster"), im Tab 32 px.

//
// Seit 2026-10-22 (Alain: "übersichtlich, aber nichts an der Verdrahtung zerstören"): liegt die Seite in einer Gruppe
// (_nav tabOf), steht unter der Leiste eine Zeile mit den Seiten der Gruppe als Tabs. Eine eigene Zeile und nicht in
// der Leiste, weil die Leiste im App-Fenster die Fensterleiste mit fester Hoehe ist.

"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { paletteOeffnen } from "./Kommandopalette";
import { navItemForPath, navTabs } from "./_nav";
import { tAdmin, type AdminLang } from "./_i18n";

/** Set by AdminShell; the pages render this bar themselves and don't know the language. */
export const AdminLangContext = createContext<AdminLang>("de");

function GroupTabs() {
  const path = usePathname() || "";
  const t = tAdmin(useContext(AdminLangContext));
  const tabs = navTabs(path);
  if (!tabs) return null;
  const current = navItemForPath(path)?.id;
  return (
    <nav aria-label="Bereich" className="klar-tabs">
      {tabs.map((i) => (
        <Link key={i.id} href={i.href} aria-current={i.id === current ? "page" : undefined} className="klar-tab">
          {t[i.labelKey] as string}
        </Link>
      ))}
    </nav>
  );
}

export function AdminTopbar({
  titel,
  bereich = "Klar Control",
  rechts,
}: {
  /** Wo ich stehe. Fett, ganz links. */
  titel: string;
  /** Was danach kommt, hinter dem Winkel. */
  bereich?: string;
  /** Platz fuer Schalter, die nur diese eine Seite hat. */
  rechts?: React.ReactNode;
}) {
  return (
    <>
      <div className="topbar">
        <SidebarTrigger className="-ml-1 size-(--klar-kopf-knopf) rounded-full" />
        <span className="crumb">
          <b>{titel}</b>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="truncate">{bereich}</span>
        </span>
        {/* Der Weg zur Palette muss sichtbar sein. Ein Kuerzel, das nirgends
            steht, kennt nur, wer es gebaut hat. Deshalb ein benannter Knopf und
            nicht nur ein Symbol, mit dem Kuerzel als Beschriftung daneben. */}
        <Button variant="pill" size="sm" onClick={paletteOeffnen} className="h-(--klar-kopf-knopf) shrink-0 pl-3 pr-1.5">
          <Search />
          <span>Springen</span>
          <kbd className="rounded-full bg-black/10 px-1.5 py-0.5 [font-family:var(--font-mono)] text-[10px] font-medium text-black/60">
            Strg K
          </kbd>
        </Button>
        {rechts}
      </div>
      <GroupTabs />
    </>
  );
}
