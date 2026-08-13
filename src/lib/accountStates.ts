// Die Vokabeln des Bestands — Zustände und ihre deutschen Namen.
//
// Bewusst eine eigene Datei ohne `server-only`: die Tabelle im Browser braucht
// dieselbe Liste wie der Store auf dem Server, und `lib/accountStatus` darf
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

/** Was der Bestand schreiben darf. Alles andere ist gemessen, nicht getippt. */
export interface AccountStatusPatch {
  state?: AccountState;
  target_per_week?: number | null;
  posts_manual?: number | null;
  note?: string | null;
}
