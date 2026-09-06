"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Der Rumpf einer Mail aus dem MyCakeDay-Postfach.
 *
 * Nachbau von `MailKoerper.tsx` bei Cakeday, mit den Farben von Klar Control.
 * Das HTML kommt schon gesaeubert von mycakeday.ch, und trotzdem steht es in
 * einem `iframe` mit `sandbox` ohne `allow-scripts` und ohne `allow-forms`:
 * eine Schicht allein muesste fehlerfrei sein, und das nimmt man bei fremdem
 * Text nicht an. `allow-same-origin` bleibt, sonst laesst sich die Hoehe des
 * Inhalts nicht messen; gefaehrlich waere das nur zusammen mit Skripten.
 */

const RAHMEN = `
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    font: 13.5px/1.7 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: %FARBE%;
    background: transparent;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  img, table { max-width: 100%; }
  img { height: auto; }
  table { border-collapse: collapse; }
  a { color: %LINK%; }
  blockquote {
    margin: 0.6em 0;
    padding-left: 0.9em;
    border-left: 2px solid %RAND%;
    color: %GEDAEMPFT%;
  }
  pre { white-space: pre-wrap; }
`;

export function MailRahmen({ html, bilderBlockiert }: { html: string; bilderBlockiert: number }) {
  const rahmen = useRef<HTMLIFrameElement>(null);
  const [hoehe, setHoehe] = useState(120);

  useEffect(() => {
    const el = rahmen.current;
    if (!el) return;

    const stil = getComputedStyle(document.documentElement);
    const wert = (name: string, rueckfall: string) => stil.getPropertyValue(name).trim() || rueckfall;
    const kopf = RAHMEN.replace("%FARBE%", wert("--fg", "#111"))
      .replace("%LINK%", wert("--accent", "#2563eb"))
      .replace("%RAND%", wert("--line", "#e5e5e5"))
      .replace("%GEDAEMPFT%", wert("--fg-3", "#6b7280"));

    el.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${kopf}</style></head><body>${html}</body></html>`;

    const messen = () => {
      if (el.offsetParent === null) return;
      if (el.getBoundingClientRect().width < 1) return;
      try {
        const dok = el.contentDocument;
        if (!dok?.body) return;
        setHoehe(Math.min(Math.max(dok.body.scrollHeight + 8, 40), 4000));
      } catch {
        /* Ohne allow-same-origin bleibt die Vorgabehoehe stehen. */
      }
    };

    el.addEventListener("load", messen);
    const nachmessen = window.setTimeout(messen, 350);
    let letzteBreite = el.getBoundingClientRect().width;
    const beobachter = new ResizeObserver(() => {
      const breite = el.getBoundingClientRect().width;
      if (Math.abs(breite - letzteBreite) < 1) return;
      letzteBreite = breite;
      messen();
    });
    beobachter.observe(el);

    return () => {
      el.removeEventListener("load", messen);
      window.clearTimeout(nachmessen);
      beobachter.disconnect();
    };
  }, [html]);

  return (
    <div>
      {bilderBlockiert > 0 ? (
        <p className="mb-2 text-[12px] text-fg-3">
          {bilderBlockiert === 1
            ? "Ein Bild aus dem Netz wurde nicht geladen."
            : `${bilderBlockiert} Bilder aus dem Netz wurden nicht geladen.`}{" "}
          Solche Bilder melden dem Absender, wann die Mail geöffnet wurde.
        </p>
      ) : null}
      <iframe
        ref={rahmen}
        title="Inhalt der Mail"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        className="w-full border-0"
        style={{ height: hoehe }}
      />
    </div>
  );
}
