// Die beiden Ansichten der To-do-Seite und ihre Adressen.
//
// Eigene Datei, weil Server- und Client-Seite dieselbe Funktion brauchen: die
// Seite baut damit die Reiter, die Wochenzeile ihre Links. Sie als Prop
// hinüberzureichen geht NICHT — eine Server-Komponente kann einer
// Client-Komponente keine Funktion übergeben (nur Serialisierbares), und der
// Fehler zeigt sich erst zur Laufzeit, nicht im Build.

export type TodoView = "todo" | "posting";

export function viewHref(view: TodoView, weekOffset: number): string {
  const qs = new URLSearchParams();
  if (view === "posting") qs.set("v", "posting");
  if (weekOffset !== 0) qs.set("w", String(weekOffset));
  const s = qs.toString();
  return s ? `/admin/todos?${s}` : "/admin/todos";
}
