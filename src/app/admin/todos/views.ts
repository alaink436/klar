// Die beiden Ansichten der To-do-Seite und ihre Adressen.
//
// Eigene Datei, weil Server- und Client-Seite dieselbe Funktion brauchen: die
// Seite baut damit die Reiter, die Wochenzeile ihre Links. Sie als Prop
// hinüberzureichen geht NICHT — eine Server-Komponente kann einer
// Client-Komponente keine Funktion übergeben (nur Serialisierbares), und der
// Fehler zeigt sich erst zur Laufzeit, nicht im Build.
//
// Zwei Ansichten, und dabei bleibt es. Am 2026-08-20 gab es kurz eine dritte
// für die Referenzvideos; sie ist am selben Tag wieder eingegangen, weil zwei
// Orte für eine Sache umständlicher waren als der Platz, den sie sparten. Das
// Referenzvideo hängt jetzt in der Kanalzeile des Postings, wo der Kanal ohnehin
// steht, und die Ebenen darüber (App, Plattform) in einer Leiste über der Tabelle.

export type TodoView = "todo" | "posting";

export function viewHref(view: TodoView, weekOffset: number): string {
  const qs = new URLSearchParams();
  if (view !== "todo") qs.set("v", view);
  if (weekOffset !== 0) qs.set("w", String(weekOffset));
  const s = qs.toString();
  return s ? `/admin/todos?${s}` : "/admin/todos";
}
