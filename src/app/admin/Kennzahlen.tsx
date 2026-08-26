// Die Kachelreihe oben auf einer Seite: Label, Zahl, ein Halbsatz darunter.
//
// Sie stand 32 Mal in fuenf Seiten als HTML-Zeichenkette, jedes Mal dieselben
// vier verschachtelten div mit den Klassen `card`, `k`, `v`, `s`. Wer eine
// Kachel dazunahm, kopierte die Zeile und tauschte den Inhalt.
//
// Bewusst mit DENSELBEN Klassen wie bisher: das CSS dafuer steht seit je im
// STYLE-Block, und wer es hier neu erfinden wuerde, aendert das Aussehen von
// fuenf Seiten, ohne sie gesehen zu haben. Der Umbau soll die Struktur
// aufraeumen, nicht das Bild verschieben.
//
// Server-Komponente: hier bewegt sich nichts, also kostet sie nichts im Bundle.

export type Kennzahl = {
  /** Die Ueberschrift der Kachel, klein und in Kapitaelchen. */
  label: string;
  /** Die Zahl selbst. Fertig formatiert, denn nur der Aufrufer weiss, ob es
      Franken, Prozent oder Stueck sind. */
  wert: string | number;
  /** Der Halbsatz darunter, der die Zahl einordnet. Ohne ihn faellt er weg. */
  zusatz?: string;
};

export function Kennzahlen({ zahlen }: { zahlen: Kennzahl[] }) {
  if (zahlen.length === 0) return null;
  return (
    <div className="cards">
      {zahlen.map((z) => (
        <div className="card" key={z.label}>
          <div className="k">{z.label}</div>
          <div className="v">{z.wert}</div>
          {z.zusatz ? <div className="s">{z.zusatz}</div> : null}
        </div>
      ))}
    </div>
  );
}
