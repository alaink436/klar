"use client";

// Cmd+K. Tippen, Enter, da.
//
// Warum ueberhaupt: Klar Control hat 21 Seiten, und der Weg dorthin ging bisher
// immer ueber die Schiene, also Augen nach links, Zeile suchen, klicken. Bei
// zwei Dutzend Zielen ist Tippen schneller als Suchen, und die Hand bleibt auf
// der Tastatur.
//
// Die Liste kommt aus `_nav.ts` und dem App-Verzeichnis, denselben Quellen wie
// die Schiene. Eine zweite, handpflegte Liste waere in der Woche auseinander
// gelaufen, in der jemand einen Menuepunkt umbenennt.
//
// `cmdk` lag schon im Projekt, aber nur der Brain-Explorer benutzte es.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { navIcon } from "./nav-icons";
import { NAV_ITEMS, orderedAll, type NavPrefs } from "./_nav";
import { tAdmin, type AdminLang } from "./_i18n";
import { LISTED_APPS, resolveBackendKey } from "@/lib/klarApps";
import { Sun } from "@/components/animate-ui/icons/sun";
import { LogOut } from "@/components/animate-ui/icons/log-out";
import { PanelLeft } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

declare global {
  interface Window {
    klarToggleTheme?: () => void;
  }
}

/** Wer die Palette oeffnen will, ohne sie zu importieren, feuert dieses Ereignis. */
export const PALETTE_EREIGNIS = "klar:palette";

/** Von aussen aufrufbar, etwa aus einem Knopf in der Kopfleiste. */
export function paletteOeffnen() {
  document.dispatchEvent(new Event(PALETTE_EREIGNIS));
}

export function Kommandopalette({
  lang,
  prefs,
  apps,
}: {
  lang: AdminLang;
  prefs: NavPrefs;
  apps: { slug: string; name: string }[];
}) {
  const t = tAdmin(lang);
  const router = useRouter();
  const [offen, setOffen] = React.useState(false);
  const { toggleSidebar } = useSidebar();

  React.useEffect(() => {
    function beiTaste(e: KeyboardEvent) {
      // Cmd+K auf dem Mac, Strg+K sonst. Das Kuerzel, das jeder kennt.
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOffen((o) => !o);
      }
    }
    // Zweiter Weg hinein: ein Ereignis. Der Knopf in der Kopfleiste feuert es,
    // und die zwanzig Seiten, die ihr Markup noch als Zeichenkette bauen,
    // koennen es mit einer Zeile ebenfalls ausloesen, ohne React zu kennen.
    function beiEreignis() {
      setOffen(true);
    }
    document.addEventListener("keydown", beiTaste);
    document.addEventListener(PALETTE_EREIGNIS, beiEreignis);
    return () => {
      document.removeEventListener("keydown", beiTaste);
      document.removeEventListener(PALETTE_EREIGNIS, beiEreignis);
    };
  }, []);

  /** Schliessen und dann handeln, sonst laeuft die Navigation gegen den Dialog. */
  const dann = React.useCallback((tun: () => void) => {
    setOffen(false);
    // Ein Bild abwarten, damit der Dialog seinen Fokus zurueckgibt, bevor die
    // neue Seite ihren nimmt.
    requestAnimationFrame(tun);
  }, []);

  // Die Eintraege in der Ordnung, die sich der Betrachter selbst gelegt hat.
  // Ausgeblendete bleiben hier absichtlich drin: aus der Schiene genommen
  // heisst "nicht taeglich", nicht "nie wieder". Genau dafuer ist die Palette da.
  const eintraege = React.useMemo(() => {
    const geordnet = orderedAll(prefs);
    const fehlend = NAV_ITEMS.filter((i) => !geordnet.some((g) => g.id === i.id));
    return [...geordnet, ...fehlend];
  }, [prefs]);

  const verdrahtet = new Set(apps.map((a) => a.slug));
  const appEintraege = LISTED_APPS.map((meta) => ({ meta, slug: resolveBackendKey(meta, verdrahtet) })).filter((a) =>
    verdrahtet.has(a.slug),
  );

  return (
    <CommandDialog
      open={offen}
      onOpenChange={setOffen}
      title="Springen"
      description="Seite, App oder Aktion suchen"
      // Kein Kreuz in der Ecke: es sass mitten im Suchfeld, und eine Palette
      // schliesst man mit Esc. Ein Knopf, den niemand trifft, ist nur Unruhe.
      showCloseButton={false}
    >
      <CommandInput placeholder="Wohin? Seite, App oder Aktion tippen." />
      <CommandList>
        <CommandEmpty>Nichts gefunden.</CommandEmpty>

        <CommandGroup heading="Seiten">
          {eintraege.map((item) => {
            const Icon = navIcon(item.icon);
            const label = t[item.labelKey] as string;
            return (
              <CommandItem
                key={item.id}
                // `value` ist, wonach cmdk sucht. Die Kennung mit hinein, damit
                // "todos" auch dann trifft, wenn der Eintrag "To-do" heisst.
                value={`${label} ${item.id}`}
                onSelect={() => dann(() => router.push(item.href))}
              >
                <Icon size={16} />
                <span>{label}</span>
              </CommandItem>
            );
          })}
          <CommandItem value={`${t.navSettings} settings`} onSelect={() => dann(() => router.push("/admin/settings"))}>
            {React.createElement(navIcon("lock"), { size: 16 })}
            <span>{t.navSettings}</span>
          </CommandItem>
        </CommandGroup>

        {appEintraege.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Apps">
              {appEintraege.map(({ meta, slug }) => (
                <CommandItem
                  key={slug}
                  value={`${meta.name} ${slug}`}
                  onSelect={() => dann(() => router.push(`/admin/${slug}`))}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={meta.icon} alt="" width={16} height={16} className="size-4 rounded-[4px] object-cover" />
                  <span>{meta.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Aktionen">
          <AnimateIcon animateOnHover>
            <CommandItem
              value="Thema wechseln hell dunkel theme"
              onSelect={() => dann(() => window.klarToggleTheme?.())}
            >
              <Sun size={16} />
              <span>Zwischen hell und dunkel wechseln</span>
            </CommandItem>
          </AnimateIcon>
          <CommandItem value="Schiene einklappen ausklappen sidebar" onSelect={() => dann(toggleSidebar)}>
            <PanelLeft className="size-4" />
            <span>Schiene ein- oder ausklappen</span>
            <CommandShortcut>Strg+B</CommandShortcut>
          </CommandItem>
          <AnimateIcon animateOnHover>
            <CommandItem
              value={`${t.navLogout} logout abmelden`}
              onSelect={() =>
                dann(() => {
                  // Route-Handler, der Cookies raeumt und umleitet: das muss
                  // eine echte Navigation sein, kein Router-Push.
                  window.location.href = "/admin/logout";
                })
              }
            >
              <LogOut size={16} />
              <span>{t.navLogout}</span>
            </CommandItem>
          </AnimateIcon>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
