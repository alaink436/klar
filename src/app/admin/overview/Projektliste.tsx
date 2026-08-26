// "Woran ich gerade arbeite", gelesen aus AI-Brain/STATUS.md ("Active Now").
// Das ist die Tabelle, die nach jeder Session ohnehin gepflegt wird, hier nur
// gespiegelt, damit die Startseite den Stand ZEIGT statt ihn ein zweites Mal
// zu verwalten.
//
// Server-Komponente: hier bewegt sich nichts, also kostet sie auch nichts im
// Bundle. Gruppiert nach Tagen, weil "heute" und "gestern" das ist, was noch im
// Kopf steckt, und alles darunter die Frage aufwirft, ob es brachliegt.

import type { BrainProject } from "@/lib/brainStatus";

function tagesgruppe(d: number | null): string {
  if (d === null) return "Ohne Datum";
  if (d === 0) return "Heute";
  if (d === 1) return "Gestern";
  if (d < 7) return "Diese Woche";
  if (d < 14) return "Letzte Woche";
  return "Länger her";
}

function wann(d: number | null): string {
  if (d === null) return "";
  if (d === 0) return "heute";
  if (d === 1) return "gestern";
  return `vor ${d} Tagen`;
}

export function Projektliste({ projekte }: { projekte: BrainProject[] }) {
  // Wie viele je Gruppe, vorab gezaehlt: die Ueberschrift traegt die Zahl.
  const proGruppe = new Map<string, number>();
  for (const p of projekte) {
    const g = tagesgruppe(p.daysAgo);
    proGruppe.set(g, (proGruppe.get(g) ?? 0) + 1);
  }

  let gruppe = "";
  return (
    <div>
      {projekte.map((p) => {
        const g = tagesgruppe(p.daysAgo);
        const ersterDerGruppe = g !== gruppe;
        if (ersterDerGruppe) gruppe = g;
        const blockiert = p.blockers.length > 0;
        const alsNaechstes = (p.blockers[0] ?? p.next[0] ?? "").replace(/\u{1F534}/gu, "").trim();

        return (
          <div key={p.name}>
            {ersterDerGruppe ? (
              <div className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-6 py-2.5">
                <span className="[font-family:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-3)]">
                  {g}
                </span>
                <span className="[font-family:var(--font-mono)] text-[9.5px] text-[var(--fg-4)]">
                  {proGruppe.get(g) ?? 0}
                </span>
              </div>
            ) : null}
            {/* Die Tagesgruppe zieht die Trennlinie, sonst doppelt sie sich. */}
            <div
              className={`flex items-start gap-3.5 px-6 py-3.5 ${
                ersterDerGruppe ? "" : "border-t border-[var(--line)]"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2.5">
                  <span className="text-[13.5px] font-semibold text-[var(--fg)]">{p.name}</span>
                  <span className="[font-family:var(--font-mono)] text-[10.5px] text-[var(--fg-4)]">
                    {wann(p.daysAgo)}
                  </span>
                  {blockiert ? (
                    <span className="[font-family:var(--font-mono)] text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--danger)]">
                      blockiert
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-[var(--fg-3)]">{p.phase}</span>
                {alsNaechstes ? (
                  <span className="mt-1 block truncate text-[11.5px] text-[var(--fg-2)]">
                    <span className="mr-1.5 [font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-[var(--fg-4)]">
                      als nächstes
                    </span>
                    {alsNaechstes}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block [font-family:var(--font-mono)] text-[15px] font-bold tabular-nums text-[var(--fg)]">
                  {p.next.length}
                </span>
                <span className="[font-family:var(--font-mono)] text-[9.5px] uppercase tracking-[0.1em] text-[var(--fg-4)]">
                  offen
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
