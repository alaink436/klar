// Die drei Ansichten der To-do-Seite und ihre Adressen.
//
// Eigene Datei, weil Server- und Client-Seite dieselbe Funktion brauchen: die
// Seite baut damit die Reiter, die Wochenzeile ihre Links. Sie als Prop
// hinüberzureichen geht NICHT — eine Server-Komponente kann einer
// Client-Komponente keine Funktion übergeben (nur Serialisierbares), und der
// Fehler zeigt sich erst zur Laufzeit, nicht im Build.
//
// `referenzen` kam am 2026-08-20 dazu. Vorher hing die Referenzliste als
// aufklappbares Panel unter der Posting-Tabelle: dort war sie erreichbar, aber
// nicht auffindbar, und für das Video eines Clips war schlicht kein Platz.
// Als eigene Ansicht bekommt sie die Breite, die ein Videospieler braucht.

export type TodoView = "todo" | "posting" | "referenzen";

export function viewHref(view: TodoView, weekOffset: number): string {
  const qs = new URLSearchParams();
  if (view !== "todo") qs.set("v", view);
  // Die Wochenwahl gilt nur für die beiden Ansichten, die eine Woche zeigen.
  // Sie in die Referenz-Adresse zu schleppen, hiesse eine Auswahl behaupten,
  // die dort nichts steuert.
  if (weekOffset !== 0 && view !== "referenzen") qs.set("w", String(weekOffset));
  const s = qs.toString();
  return s ? `/admin/todos?${s}` : "/admin/todos";
}
