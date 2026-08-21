// SERVER ONLY. Die Richtung je Kanal, mit Verlauf — `klar_account_direction`
// im Klar-Hub-Supabase exiuwektrqxvycclqfdd, Migration 0027.
//
// Der Unterschied zu `accountStatus`: dort steht genau eine Zeile je Kanal und
// jede Änderung überschreibt sie. Hier steht eine Zeile je Kanal UND
// Richtungswechsel. Die laufende ist die mit `bis is null`, alles davor bleibt
// stehen. Deshalb gibt es kein „update richtung": ein Richtungswechsel ist
// zwei Schreibvorgänge (alte schliessen, neue anlegen), und genau das macht
// `reorient()`.
//
// Was sich am Zeiger ändern darf, ohne Wechsel zu sein — Referenz, Spiegelung,
// Grund — geht über `patchCurrent()` in die laufende Zeile. Eine falsch
// getippte Referenz zu korrigieren ist keine Neuorientierung.
import "server-only";
import { isDirection, type Direction } from "./accountStates";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST = `${URL_BASE}/rest/v1/klar_account_direction`;

function hdr(extra?: HeadersInit): HeadersInit {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Steckplatz einer Richtung. 1 ist das Hauptformat, 2 laeuft daneben mit.
 *
 * Bis Migration 0037 gab es nur einen. Der zweite kam, weil ein teures und ein
 * guenstiges Format gleichzeitig laufen sollen statt nacheinander — siehe den
 * Kopf von `migrations/0037_zweites_format.sql`.
 */
export type Slot = 1 | 2;
export const SLOTS: readonly Slot[] = [1, 2];

export function istSlot(v: unknown): v is Slot {
  return v === 1 || v === 2;
}

/** Schluessel fuer Karten, die je Kanal UND Platz zaehlen. */
export function slotKey(key: string, slot: Slot): string {
  return `${key}#${slot}`;
}

export interface AccountDirection {
  id: number;
  account_key: string;
  /** 1 = Hauptformat, 2 = mitlaufendes. Alles vor 0037 steht auf 1. */
  slot: Slot;
  richtung: Direction;
  /**
   * Freie Variante INNERHALB der Richtung (0038), etwa `Widget` gegen
   * `Higgsfield` bei derselben Slideshow.
   *
   * Ergaenzt die feste Liste, ersetzt sie nicht: `richtung` bleibt ueber alle
   * Kanaele zaehlbar, die Variante unterscheidet innerhalb. Die Liste wieder
   * zu oeffnen haette zurueck zu dem gefuehrt, was 0027 abgeschafft hat.
   */
  variante: string | null;
  /** Kennung aus Projects/00-Referenzen.md im AI-Brain, Form `<projekt>/<id>`. */
  referenz: string | null;
  /** `account_key` des Kanals, dessen Richtung übernommen wird. */
  spiegelt: string | null;
  /** "YYYY-MM-DD" */
  ab: string;
  /** "YYYY-MM-DD" oder null, solange die Richtung läuft. */
  bis: string | null;
  grund: string | null;
}

export interface DirectionPatch {
  referenz?: string | null;
  spiegelt?: string | null;
  /** Die Variante zu aendern ist eine Korrektur, kein Wechsel: kein Verlauf. */
  variante?: string | null;
}

export function accountDirectionConfigured(): boolean {
  return Boolean(KEY);
}

function clean(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalize(r: AccountDirection): AccountDirection {
  return {
    ...r,
    // Alte Zeilen ohne Platz gibt es nach 0037 nicht mehr, aber eine Antwort
    // aus einem Cache oder einem aelteren Deploy koennte sie noch tragen.
    slot: istSlot(r.slot) ? r.slot : 1,
    ab: String(r.ab).slice(0, 10),
    bis: r.bis ? String(r.bis).slice(0, 10) : null,
  };
}

/**
 * Die laufenden Richtungen je Kanal (`bis is null`), nach `account_key`.
 *
 * Seit 0037 sind es bis zu ZWEI je Kanal, nach Steckplatz sortiert: Platz 1
 * zuerst. Die Sortierung ist nicht Kosmetik — das Board ist eine Tabelle, die
 * man ueberfliegt, und zwei Zeilen ohne feste Reihenfolge stuenden mal so, mal
 * so. Deshalb kommt die Reihenfolge aus den Daten, nicht aus der Antwort.
 *
 * Ein Kanal ohne Eintrag fehlt in der Karte — das ist der Normalfall für alles,
 * was noch keine Richtung hat, und keine Ausnahme. Ein Kanal mit nur einem
 * zweiten Format (Platz 1 aufgegeben, Platz 2 laeuft weiter) hat eine Liste
 * der Laenge eins, deren einziger Eintrag `slot === 2` traegt.
 */
export async function listCurrentDirections(): Promise<Map<string, AccountDirection[]>> {
  const out = new Map<string, AccountDirection[]>();
  if (!KEY) return out;
  try {
    const res = await fetch(`${REST}?select=*&bis=is.null&order=slot.asc&limit=500`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return out;
    const rows = (await res.json()) as AccountDirection[];
    if (!Array.isArray(rows)) return out;
    for (const r of rows) {
      if (!isDirection(r.richtung)) continue;
      const liste = out.get(r.account_key) ?? [];
      liste.push(normalize(r));
      out.set(r.account_key, liste);
    }
    for (const liste of out.values()) liste.sort((a, b) => a.slot - b.slot);
    return out;
  } catch {
    return out;
  }
}

/**
 * Wie viele ABGESCHLOSSENE Richtungen ein Kanal hinter sich hat.
 *
 * Das ist die Zahl, die im Board neben der laufenden Richtung steht — Alains
 * Entscheid vom 2026-08-20: eine Zahl, keine Zeitleiste. 24 Kanäle mit voller
 * Zeitleiste wären nicht mehr lesbar, und die Zahl allein sagt schon, ob sich
 * das Aufklappen lohnt.
 *
 * Gezählt wird im Node-Prozess, gleiche Linie wie `listPostTotals`: PostgREST
 * liefert Gruppierungen nur mit eingeschalteten Aggregatfunktionen, und die
 * Tabelle wächst um ein paar Zeilen im Monat.
 */
export async function listDirectionCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!KEY) return out;
  try {
    const res = await fetch(`${REST}?select=account_key,slot&bis=not.is.null&limit=5000`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return out;
    const rows = (await res.json()) as { account_key: string; slot: number }[];
    if (!Array.isArray(rows)) return out;
    // Gezaehlt wird je Kanal UND Platz, Schluessel `key#slot`. Sonst stuende
    // neben dem guenstigen Zweitformat die Zahl der Wechsel des Hauptformats,
    // und das Aufklappen zeigte einen Verlauf, der nicht dazugehoert.
    for (const r of rows) {
      const k = slotKey(r.account_key, istSlot(r.slot) ? r.slot : 1);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Der Verlauf eines Kanals, neueste zuerst. Für das Aufklappen im Board.
 *
 * Ohne `slot` kommt alles, mit `slot` nur dieser Steckplatz. Das Board klappt
 * je Platz auf, weil ein Hauptformat und ein mitlaufendes zwei Geschichten
 * sind und nicht eine.
 */
export async function listDirectionHistory(
  key: string,
  slot?: Slot,
): Promise<AccountDirection[]> {
  if (!KEY || !key.trim()) return [];
  try {
    const filter = slot ? `&slot=eq.${slot}` : "";
    const res = await fetch(
      `${REST}?select=*&account_key=eq.${encodeURIComponent(key)}${filter}&order=ab.desc,id.desc&limit=100`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as AccountDirection[];
    return Array.isArray(rows) ? rows.map(normalize) : [];
  } catch {
    return [];
  }
}

/**
 * Neu orientieren: die laufende Richtung schliessen und eine neue anlegen.
 *
 * Der `grund` gehört an die ALTE Zeile, nicht an die neue — die Frage, die
 * man später stellt, ist „warum haben wir mit Slideshow aufgehört", nicht
 * „warum haben wir mit Talking Head angefangen".
 *
 * Reihenfolge zählt: erst schliessen, dann anlegen. Andersherum lägen für einen
 * Moment zwei Zeilen mit `bis is null` vor, und der Unique-Index aus 0027
 * würde das Anlegen abweisen.
 *
 * Wer dieselbe Richtung nochmal setzt, ändert nichts — das wäre kein Wechsel,
 * sondern ein Doppelklick.
 */
export async function reorient(
  key: string,
  richtung: Direction,
  opts: {
    referenz?: string | null;
    spiegelt?: string | null;
    variante?: string | null;
    grund?: string | null;
    /** Welcher Steckplatz. Ohne Angabe das Hauptformat. */
    slot?: Slot;
  } = {},
): Promise<{ ok: boolean }> {
  if (!KEY || !key.trim() || !isDirection(richtung)) return { ok: false };
  const account = key.trim().slice(0, 200);
  const slot: Slot = istSlot(opts.slot) ? opts.slot : 1;
  const tag = heute();

  try {
    const laufend = await fetch(
      `${REST}?select=id,richtung,ab&account_key=eq.${encodeURIComponent(account)}&slot=eq.${slot}&bis=is.null&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    const offen = laufend.ok ? ((await laufend.json()) as AccountDirection[]) : [];
    const alt = Array.isArray(offen) ? offen[0] : undefined;

    if (alt?.richtung === richtung) return { ok: true };

    if (alt) {
      // `bis` darf nicht vor `ab` liegen (Check aus 0027). Eine Richtung, die
      // noch am selben Tag gewechselt wird, endet an ihrem Starttag.
      const bis = alt.ab && String(alt.ab).slice(0, 10) > tag ? String(alt.ab).slice(0, 10) : tag;
      const zu = await fetch(`${REST}?id=eq.${alt.id}`, {
        method: "PATCH",
        headers: hdr({ Prefer: "return=minimal" }),
        body: JSON.stringify({ bis, grund: clean(opts.grund, 500) }),
      });
      if (!zu.ok) return { ok: false };
    }

    const neu = await fetch(REST, {
      method: "POST",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        account_key: account,
        slot,
        richtung,
        variante: clean(opts.variante, 80),
        referenz: clean(opts.referenz, 200),
        spiegelt: clean(opts.spiegelt, 200),
        ab: tag,
      }),
    });
    return { ok: neu.ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Referenz oder Spiegelung der LAUFENDEN Richtung korrigieren, ohne dass daraus
 * ein Wechsel wird. Gibt es noch keine laufende Zeile, passiert nichts: ein
 * Zeiger ohne Richtung hätte nichts, woran er hängt.
 */
export async function patchCurrent(
  key: string,
  patch: DirectionPatch,
  slot: Slot = 1,
): Promise<{ ok: boolean }> {
  if (!KEY || !key.trim()) return { ok: false };
  const row: Record<string, unknown> = {};
  if (patch.referenz !== undefined) row.referenz = clean(patch.referenz, 200);
  if (patch.spiegelt !== undefined) row.spiegelt = clean(patch.spiegelt, 200);
  if (patch.variante !== undefined) row.variante = clean(patch.variante, 80);
  if (!Object.keys(row).length) return { ok: true };
  const s: Slot = istSlot(slot) ? slot : 1;

  try {
    const res = await fetch(
      `${REST}?account_key=eq.${encodeURIComponent(key.trim())}&slot=eq.${s}&bis=is.null`,
      {
        method: "PATCH",
        headers: hdr({ Prefer: "return=minimal" }),
        body: JSON.stringify(row),
      },
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Einen Steckplatz beenden, ohne eine neue Richtung anzulegen.
 *
 * `reorient()` kann das nicht: es ist ein WECHSEL und legt immer eine neue
 * Zeile an. Genau das will man beim mitlaufenden Format aber nicht — wer das
 * teure Format aufgibt, weil das Guthaben beim Anbieter zur Neige geht, hoert
 * damit auf und faengt nichts Neues an.
 *
 * Der Grund gehoert wie beim Wechsel an die geschlossene Zeile: die Frage, die
 * man spaeter stellt, ist „warum haben wir damit aufgehoert".
 *
 * Platz 2 zu beenden laesst Platz 1 unberuehrt, und umgekehrt. Es rutscht
 * nichts nach; sonst hiesse ein alter Verlaufseintrag rueckwirkend etwas
 * anderes, als er zum Zeitpunkt seiner Entstehung hiess.
 */
export async function beendeRichtung(
  key: string,
  slot: Slot,
  grund?: string | null,
): Promise<{ ok: boolean }> {
  if (!KEY || !key.trim() || !istSlot(slot)) return { ok: false };
  const account = key.trim().slice(0, 200);
  const tag = heute();
  try {
    const laufend = await fetch(
      `${REST}?select=id,ab&account_key=eq.${encodeURIComponent(account)}&slot=eq.${slot}&bis=is.null&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    const offen = laufend.ok ? ((await laufend.json()) as AccountDirection[]) : [];
    const alt = Array.isArray(offen) ? offen[0] : undefined;
    // Nichts zu beenden ist kein Fehler: der Knopf steht nur da, wenn etwas
    // laeuft, aber zwei Klicks hintereinander duerfen nicht rot werden.
    if (!alt) return { ok: true };

    const bis = alt.ab && String(alt.ab).slice(0, 10) > tag ? String(alt.ab).slice(0, 10) : tag;
    const res = await fetch(`${REST}?id=eq.${alt.id}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({ bis, grund: clean(grund, 500) }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
