// Zeitstempel in Klar Control — immer in Schweizer Ortszeit.
//
// Die Admin-Seiten sind Server-Komponenten (`force-dynamic`), gerendert wird
// also auf Vercel, und dort steht die Maschine auf UTC. `new Date(iso)
// .toLocaleString("de-CH")` ohne `timeZone` nimmt die Zone des Servers, nicht
// die des Betrachters: eine Mail, die um 16:12 Schweizer Zeit rausging, stand
// im MyCakeDay-Postfach als 14:12. Das Datum stimmt dabei meistens, nur die
// Uhrzeit nicht — deshalb faellt es kaum auf und ist trotzdem falsch.
//
// Klar Control ist Alains Einzel-Admin, kein Werkzeug fuer fremde Zeitzonen.
// Die Zone steht darum hart hier und wird nicht aus dem Browser gelesen: der
// Wert ist auf dem Server und im Client derselbe, egal wo jemand sitzt, und
// eine Server-Komponente kann die Browser-Zone ohnehin nicht kennen.

export const ZONE = "Europe/Zurich";

/**
 * Zeitpunkt in Zuercher Ortszeit. `optionen` sind die von `Intl.DateTimeFormat`
 * ohne `timeZone` — die setzt diese Funktion. Ungueltige Werte geben `fallback`
 * statt „Invalid Date".
 */
export function inZone(
  wert: string | number | Date | null | undefined,
  optionen: Intl.DateTimeFormatOptions,
  locale: string = "de-CH",
  fallback: string = "—",
): string {
  const d = wert instanceof Date ? wert : new Date(String(wert ?? ""));
  if (isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, { ...optionen, timeZone: ZONE }).format(d);
}

/** Nur das Datum, in der Form, die `toLocaleDateString` ohne Optionen liefert. */
export function datumInZone(
  wert: string | number | Date | null | undefined,
  locale: string = "de-CH",
  fallback: string = "—",
): string {
  return inZone(wert, { year: "numeric", month: "numeric", day: "numeric" }, locale, fallback);
}

/**
 * Der Tag in Zuercher Ortszeit als `YYYY-MM-DD` — zum Vergleichen, nicht zum
 * Anzeigen. `heute?` mit `toDateString()` zu beantworten waere derselbe Fehler
 * wie oben: kurz nach Mitternacht liegt der Server noch im Vortag.
 */
export function tagInZone(wert: string | number | Date | null | undefined): string {
  const d = wert instanceof Date ? wert : new Date(String(wert ?? ""));
  if (isNaN(d.getTime())) return "";
  // en-CA formatiert als YYYY-MM-DD — genau das Format, das wir vergleichen.
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(d);
}
