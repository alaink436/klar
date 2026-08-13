// SERVER ONLY. Der von Hand gepflegte Teil der Posting-Landschaft: Zustand und
// Rhythmus je Account (`klar_account_status`) und ein Haken je Account und Tag
// (`klar_post_log`). Beide im Klar-Hub-Supabase exiuwektrqxvycclqfdd,
// Migrationen 0017 + 0018.
//
// Die Trennlinie ist dieselbe wie bei den To-dos: was sich messen lässt, wird
// gemessen und nicht getippt. Welche Accounts es gibt, steht in
// lib/socialAccounts; wie viele Posts wirklich draussen liegen, liest der
// Profil-Scraper auf /admin/content. Hier landet nur die Entscheidung — läuft,
// wärmt auf, pausiert, aufgegeben — plus der Rhythmus, eine Notiz und die
// tägliche Selbstauskunft "gepostet".
//
// Zwei Sorten Zeilen in `klar_account_status`:
//   ohne app/platform/handle — gehört zu einem Account aus dem Code
//   mit    app/platform/handle — selbst angelegt, existiert nur hier. Das ist
//     der Weg für alles, was lib/socialAccounts nicht kennt (YouTube, Threads,
//     ein zweiter Zweitaccount); vorher brauchte so etwas einen Deploy.
import "server-only";
import { isAccountState, type AccountState, type AccountStatusPatch } from "./accountStates";

export type { AccountState, AccountStatusPatch };

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST_STATUS = `${URL_BASE}/rest/v1/klar_account_status`;
const REST_LOG = `${URL_BASE}/rest/v1/klar_post_log`;

function hdr(extra?: HeadersInit): HeadersInit {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface AccountStatus {
  account_key: string;
  state: AccountState;
  /** ISO-Wochentage 1–7. Leer = kein fester Rhythmus. */
  rhythm: number[];
  note: string | null;
  /** Gesetzt nur bei selbst angelegten Accounts. */
  app: string | null;
  platform: string | null;
  handle: string | null;
  updated_at: string;
}

export interface PostLogEntry {
  account_key: string;
  /** "YYYY-MM-DD". */
  day: string;
  note: string | null;
}

export function accountStatusConfigured(): boolean {
  return Boolean(KEY);
}

function normalizeState(v: unknown): AccountState {
  return isAccountState(v) ? v : "active";
}

function normalizeRhythm(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const days = v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Alle gepflegten Zeilen, nach `account_key`. Ohne Key eine leere Karte. */
export async function listAccountStatus(): Promise<Map<string, AccountStatus>> {
  const out = new Map<string, AccountStatus>();
  if (!KEY) return out;
  try {
    const res = await fetch(`${REST_STATUS}?select=*&limit=500`, { headers: hdr(), cache: "no-store" });
    if (!res.ok) return out;
    const rows = (await res.json()) as AccountStatus[];
    if (!Array.isArray(rows)) return out;
    for (const r of rows) {
      out.set(r.account_key, { ...r, state: normalizeState(r.state), rhythm: normalizeRhythm(r.rhythm) });
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Upsert auf den Primärschlüssel: die erste Änderung an einem Account legt seine
 * Zeile an, jede weitere schreibt hinein. `merge-duplicates` ist der Grund,
 * warum der Aufrufer nie wissen muss, ob es die Zeile schon gibt.
 *
 * Geprüft wird hier und nicht nur im Formular — eine Server-Action ist eine
 * eigene, direkt aufrufbare URL.
 */
export async function saveAccountStatus(
  key: string,
  patch: AccountStatusPatch,
): Promise<{ ok: boolean }> {
  if (!KEY || !key.trim()) return { ok: false };

  const row: Record<string, unknown> = {
    account_key: key.trim().slice(0, 200),
    updated_at: new Date().toISOString(),
  };
  if (patch.state !== undefined) row.state = normalizeState(patch.state);
  if (patch.rhythm !== undefined) row.rhythm = normalizeRhythm(patch.rhythm);
  if (patch.note !== undefined) row.note = clean(patch.note, 500);
  if (patch.app !== undefined) row.app = clean(patch.app, 60);
  if (patch.platform !== undefined) row.platform = clean(patch.platform, 40)?.toLowerCase() ?? null;
  if (patch.handle !== undefined) row.handle = clean(patch.handle, 80)?.replace(/^@/, "") ?? null;

  try {
    const res = await fetch(REST_STATUS, {
      method: "POST",
      headers: hdr({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(row),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/** Nur für selbst angelegte Zeilen — Code-Accounts verschwinden dadurch nicht. */
export async function deleteAccountStatus(key: string): Promise<{ ok: boolean }> {
  if (!KEY || !key.trim()) return { ok: false };
  try {
    const res = await fetch(`${REST_STATUS}?account_key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: hdr({ Prefer: "return=minimal" }),
    });
    if (!res.ok) return { ok: false };
    // Die Haken hängen am selben Schlüssel und hätten sonst keinen Besitzer mehr.
    await fetch(`${REST_LOG}?account_key=eq.${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: hdr({ Prefer: "return=minimal" }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Haken einer Woche (`from`/`to` als "YYYY-MM-DD", beide inklusive). */
export async function listPostLog(from: string, to: string): Promise<PostLogEntry[]> {
  if (!KEY || !isDay(from) || !isDay(to)) return [];
  try {
    const res = await fetch(
      `${REST_LOG}?select=account_key,day,note&day=gte.${from}&day=lte.${to}&limit=2000`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as PostLogEntry[];
    return Array.isArray(rows) ? rows.map((r) => ({ ...r, day: r.day.slice(0, 10) })) : [];
  } catch {
    return [];
  }
}

/**
 * Haken setzen oder wegnehmen. `done=false` löscht die Zeile, statt ein Flag
 * umzulegen: ein nicht gesetzter Haken ist die Abwesenheit einer Aussage, und
 * so kann die Tabelle nie von leeren Nein-Zeilen zuwachsen.
 */
export async function setPostDone(
  key: string,
  day: string,
  done: boolean,
  note?: string | null,
): Promise<{ ok: boolean }> {
  if (!KEY || !key.trim() || !isDay(day)) return { ok: false };
  try {
    if (!done) {
      const res = await fetch(
        `${REST_LOG}?account_key=eq.${encodeURIComponent(key)}&day=eq.${day}`,
        { method: "DELETE", headers: hdr({ Prefer: "return=minimal" }) },
      );
      return { ok: res.ok };
    }
    const res = await fetch(REST_LOG, {
      method: "POST",
      headers: hdr({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        account_key: key.trim().slice(0, 200),
        day,
        note: note === undefined ? undefined : clean(note, 300),
        done_at: new Date().toISOString(),
      }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

function clean(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim().slice(0, max);
  return s || null;
}

function isDay(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
