"use client";

// Toaster fuer Klar Control.
//
// Die Fassung aus der Registry las das Thema aus `next-themes`. Klar hat das
// nicht: hell und dunkel haengen hier an `data-theme` auf dem <html>, gesetzt
// von einem Inline-Skript im Kopf, damit die erste Farbe schon vor React
// stimmt. Ein zweites Themensystem daneben haette genau einen Effekt gehabt,
// naemlich Meldungen in der falschen Helligkeit. Also lesen wir dieselbe
// Quelle und hoeren mit einem MutationObserver auf den Umschalter.
//
// Farben kommen aus der Token-Bruecke, deshalb steht hier keine einzige.

import * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";

/** Was gerade gilt: das gesetzte data-theme, sonst die Einstellung des Geraets. */
function themaLesen(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const gesetzt = document.documentElement.dataset.theme;
  if (gesetzt === "light" || gesetzt === "dark") return gesetzt;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const Toaster = ({ ...props }: ToasterProps) => {
  const [thema, setThema] = React.useState<"light" | "dark">("dark");

  React.useEffect(() => {
    setThema(themaLesen());
    // klarToggleTheme() schreibt das Attribut, ohne dass React davon erfaehrt.
    const beobachter = new MutationObserver(() => setThema(themaLesen()));
    beobachter.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    // Und wer nie umgeschaltet hat, folgt weiter dem Geraet.
    const medien = window.matchMedia?.("(prefers-color-scheme: dark)");
    const beiWechsel = () => setThema(themaLesen());
    medien?.addEventListener?.("change", beiWechsel);
    return () => {
      beobachter.disconnect();
      medien?.removeEventListener?.("change", beiWechsel);
    };
  }, []);

  return (
    <Sonner
      theme={thema}
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
