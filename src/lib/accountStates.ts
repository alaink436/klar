// Die Vokabeln des Posting-Boards — Zustände, Wochentage und was sich schreiben
// lässt.
//
// Bewusst eine eigene Datei ohne `server-only`: die Tabelle im Browser braucht
// dieselben Listen wie der Store auf dem Server, und `lib/accountStatus` darf
// nicht in ein Client-Bundle geraten (dort steckt der Service-Key-Zugriff).
// Hier liegt deshalb nur, was beide Seiten gefahrlos lesen dürfen.

/** aktiv · wärmt auf · pausiert · aufgegeben */
export type AccountState = "active" | "warmup" | "paused" | "dropped";

export const ACCOUNT_STATES: readonly AccountState[] = ["active", "warmup", "paused", "dropped"] as const;

export const ACCOUNT_STATE_LABEL: Record<AccountState, string> = {
  active: "Läuft",
  warmup: "Wärmt auf",
  paused: "Pausiert",
  dropped: "Aufgegeben",
};

export function isAccountState(v: unknown): v is AccountState {
  return ACCOUNT_STATES.includes(v as AccountState);
}

/**
 * Der Rhythmus benennt Wochentage, keine Anzahl — ISO 1 = Montag … 7 = Sonntag.
 * Eine Zahl ("dreimal die Woche") liesse sich nicht in einen Kalender zeichnen,
 * weil niemand wüsste, an welchen Tagen der Haken hingehört.
 */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const WEEKDAY_SHORT: Record<number, string> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
  7: "So",
};

/** Wochentage als lesbare Kette, oder ein Strich wenn nichts geplant ist. */
export function rhythmLabel(rhythm: number[]): string {
  const days = [...rhythm].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).filter(Boolean);
  return days.length ? days.join(" · ") : "—";
}

/** Was am Account gepflegt wird. Alles andere ist gemessen, nicht getippt. */
export interface AccountStatusPatch {
  state?: AccountState;
  rhythm?: number[];
  note?: string | null;
  /** Nur für selbst angelegte Zeilen — Accounts, die nicht im Code stehen. */
  app?: string | null;
  platform?: string | null;
  handle?: string | null;
}
