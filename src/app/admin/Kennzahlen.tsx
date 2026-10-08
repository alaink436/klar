// Die Kachelreihe oben auf einer Seite: Label, Zahl, ein Halbsatz darunter.
//
// Sie stand 32 Mal in fuenf Seiten als HTML-Zeichenkette, jedes Mal dieselben
// vier verschachtelten div mit den Klassen `card`, `k`, `v`, `s`. Wer eine
// Kachel dazunahm, kopierte die Zeile und tauschte den Inhalt.
//
// Seit dem Redesign (2026-10-08, Ticket 03) steht jede Kachel als Karte mit
// glaenzender Kante (`TextureCard`), die Zahl mit Verlauf von Weiss nach Grau.
// Analytics, App-Nutzung, Content und die Account-Landkarte zeigen ihre
// Kennzahlen alle hierueber, statt je eine eigene Kachel zu bauen.
//
// Ohne Hooks und ohne Server-Importe: laeuft als Server-Komponente und laesst
// sich genauso aus einer Client-Komponente heraus benutzen.

import { TextureCard } from "@/components/ui/texture-card";
import { cn } from "@/lib/utils";

export type Kennzahl = {
  /** Die Ueberschrift der Kachel, klein und in Kapitaelchen. */
  label: string;
  /** Die Zahl selbst. Fertig formatiert, denn nur der Aufrufer weiss, ob es
      Franken, Prozent oder Stueck sind. */
  wert: string | number;
  /** Der Halbsatz darunter, der die Zahl einordnet. Ohne ihn faellt er weg. */
  zusatz?: string;
};

export function Kennzahlen({ zahlen, className }: { zahlen: Kennzahl[]; className?: string }) {
  if (zahlen.length === 0) return null;
  return (
    <div className={cn("mb-8 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]", className)}>
      {zahlen.map((z) => {
        // Ein Wort statt einer Zahl ("kelva.space/get") steht kleiner, sonst
        // laeuft es auf dem Handy ueber die Kante.
        const lang = String(z.wert).length > 9;
        return (
          <TextureCard key={z.label} className="px-5 pb-4 pt-[18px]">
            <div className="[font-family:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.14em] text-fg-3">
              {z.label}
            </div>
            <div
              className={cn(
                "klar-verlauf mt-2.5 w-fit max-w-full font-medium leading-none tracking-[-0.03em] [overflow-wrap:anywhere] [font-variant-numeric:tabular-nums]",
                lang ? "text-[16px] leading-tight sm:text-[19px]" : "text-[32px]",
              )}
            >
              {z.wert}
            </div>
            {z.zusatz ? <div className="mt-2.5 text-[12.5px] leading-snug text-fg-3">{z.zusatz}</div> : null}
          </TextureCard>
        );
      })}
    </div>
  );
}
