// Die Leiste ueber dem Seiteninhalt: wo bin ich, und die zwei Schalter, die
// ueberall gleich sind.
//
// Bis 2026-08-25 baute jede der 21 Admin-Seiten diese Leiste selbst als
// HTML-Zeichenkette zusammen und schrieb sie per dangerouslySetInnerHTML in die
// Seite. Zweiundzwanzig Stellen fuer eine Leiste. Hier steht sie einmal.
//
// Der Umschalter fuer hell/dunkel ruft weiterhin `klarToggleTheme()`, das
// Skript aus `_shared.ts`, das im Layout einmal geladen wird. Das ist Absicht:
// die Umschaltung muss VOR dem ersten Bild greifen, sonst blitzt die falsche
// Helligkeit auf, und dafuer ist ein Inline-Skript im Kopf der richtige Ort.
// Neu ist nur, dass der Knopf ein echtes Element mit bewegten Symbolen ist.

"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Sun } from "@/components/animate-ui/icons/sun";
import { Moon } from "@/components/animate-ui/icons/moon";

declare global {
  interface Window {
    klarToggleTheme?: () => void;
  }
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
    <div className="topbar">
      <SidebarTrigger className="-ml-1 size-8" />
      <span className="crumb">
        <b>{titel}</b>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span>{bereich}</span>
      </span>
      {rechts}
      <Tooltip>
        <TooltipTrigger asChild>
          <AnimateIcon animateOnHover>
            <button
              type="button"
              className="tbtn"
              aria-label="Zwischen hell und dunkel wechseln"
              onClick={() => window.klarToggleTheme?.()}
            >
              {/* Beide Symbole stehen im DOM; welches sichtbar ist, entscheidet
                  das CSS zu `.tbtn .sun-icon` / `.moon-icon` in `_shared.ts`
                  anhand von data-theme. So bleibt der Knopf beim ersten Bild
                  richtig, ohne auf React zu warten. */}
              <span className="sun-icon">
                <Sun size={15} />
              </span>
              <span className="moon-icon">
                <Moon size={15} />
              </span>
            </button>
          </AnimateIcon>
        </TooltipTrigger>
        <TooltipContent side="bottom">Hell oder dunkel</TooltipContent>
      </Tooltip>
    </div>
  );
}
