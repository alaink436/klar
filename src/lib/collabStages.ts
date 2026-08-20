// Das Vokabular für den Stand eines Collab-Gesprächs — Stufen, Beschriftungen,
// Erklärsätze. BEWUSST eine eigene Datei ohne "server-only" und ohne
// "use client": das Board (Client-Komponente) und die Schreib-Route (Server)
// brauchen dieselbe Liste, und ein Wert, der über eine der beiden Grenzen
// importiert wird, kommt drüben nicht als Array an — genau daran ist am
// 2026-07-11 schon einmal die Inbox zur Laufzeit gescheitert (INBOX_FILTERS).
//
// Der Stand ist die zweite Achse neben "wer schrieb zuletzt": die Nachrichten
// sagen, wessen Zug es ist, diese Leiter sagt, wie weit die Sache gediehen
// ist. Persistiert in `klar_collab_stages` (Migration 0026), gepflegt von Hand
// über /admin/collab/stage — es leitet sich nichts davon ab, es ist reine
// Dokumentation.

export const COLLAB_STAGES = [
  "kontakt",
  "gespraech",
  "zugesagt",
  "material",
  "live",
  "abgesagt",
] as const;
export type CollabStage = (typeof COLLAB_STAGES)[number];

export const COLLAB_STAGE_LABELS: Record<CollabStage, string> = {
  kontakt: "Kontakt",
  gespraech: "Im Gespräch",
  zugesagt: "Zugesagt",
  material: "Material raus",
  live: "Content live",
  abgesagt: "Abgesagt",
};

/** Ein Satz pro Stufe, im Formular direkt unter der Auswahl — damit „Material
 *  raus“ nicht bei jedem Gespräch etwas anderes heisst. */
export const COLLAB_STAGE_HINTS: Record<CollabStage, string> = {
  kontakt: "Angeschrieben oder angefragt, nichts abgemacht.",
  gespraech: "Man redet über Konditionen, Termin oder Inhalt.",
  zugesagt: "Beide sind sich einig, geliefert ist noch nichts.",
  material: "Code, Assets oder Briefing sind raus, der Post steht aus.",
  live: "Der Beitrag ist veröffentlicht.",
  abgesagt: "Abgelehnt, versandet oder von uns beendet.",
};

export function isCollabStage(v: string): v is CollabStage {
  return (COLLAB_STAGES as readonly string[]).includes(v);
}

/** Obergrenze der freien Notiz — Formular und Store halten dieselbe Zahl. */
export const COLLAB_NOTE_MAX = 2000;
