// Die Feldoptik des Posting-Boards, an einer Stelle.
//
// Eigene Datei, seit die Richtungs-Zelle aus `PostingBoard.tsx` ausgezogen ist:
// beide brauchen dieselbe Eingabefeld-Klasse, und eine zweite Fassung driftet
// beim ersten Anpassen auseinander. Aus `PostingBoard` zu importieren ginge
// nicht ohne Zirkel, weil PostingBoard die Zelle einbindet.

export const FIELD =
  "h-8 px-2 text-[12px] [font-family:var(--font-body)] text-fg bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none";
