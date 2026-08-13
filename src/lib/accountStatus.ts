// SERVER ONLY. Der von Hand gepflegte Zustand je Social-Account (Tabelle
// `klar_account_status`, Migration 0017, Klar-Hub-Supabase exiuwektrqxvycclqfdd).
//
// Die Trennlinie ist dieselbe wie bei den To-dos: was sich messen lässt, wird
// gemessen und nicht getippt. Wie viele Accounts es gibt, steht in
// lib/socialAccounts; wie viele Posts draufliegen, liest lib/contentWarmup vom
// Profil; ob die Pipeline dorthin posten kann, sagt Blotato. Hier steht nur die
// Entscheidung dazu — läuft, wärmt auf, pausiert, aufgegeben — plus ein Soll
// pro Woche, eine Notiz und (nur für X, wo niemand scrapen kann) eine selbst
// gezählte Postzahl.
//
// Fehlt eine Zeile, ist das kein Fehler: die Vorgabe kommt dann aus der Rolle
// im Code (`legacy` heisst aufgegeben, sonst aktiv). Der Bestand ist also vom
// ersten Aufruf an vollständig, ohne dass jemand 16 Zeilen anlegen muss.
import "server-only";
import { isAccountState, type AccountState, type AccountStatusPatch } from "./accountStates";

export type { AccountState, AccountStatusPatch };

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST = `${URL_BASE}/rest/v1/klar_account_status`;

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
  /** Soll-Posts pro Woche, oder null wenn kein Ziel gesetzt ist. */
  target_per_week: number | null;
  /** Selbst gezählt — nur da nötig, wo kein Profil-Scrape möglich ist (X). */
  posts_manual: number | null;
  note: string | null;
  updated_at: string;
}

export function accountStatusConfigured(): boolean {
  return Boolean(KEY);
}

function normalizeState(v: unknown): AccountState {
  return isAccountState(v) ? v : "active";
}

/** Alle gepflegten Zeilen, nach `account_key`. Ohne Key eine leere Karte. */
export async function listAccountStatus(): Promise<Map<string, AccountStatus>> {
  const out = new Map<string, AccountStatus>();
  if (!KEY) return out;
  try {
    const res = await fetch(`${REST}?select=*&limit=500`, { headers: hdr(), cache: "no-store" });
    if (!res.ok) return out;
    const rows = (await res.json()) as AccountStatus[];
    if (!Array.isArray(rows)) return out;
    for (const r of rows) out.set(r.account_key, { ...r, state: normalizeState(r.state) });
    return out;
  } catch {
    return out;
  }
}

/**
 * Upsert auf den Primärschlüssel: die erste Änderung an einem Account legt
 * seine Zeile an, jede weitere schreibt hinein. `merge-duplicates` ist der
 * Grund, warum der Aufrufer nie wissen muss, ob es die Zeile schon gibt.
 *
 * Zahlen werden hier begrenzt und nicht nur im Formular — ein Server-Action-
 * Aufruf ist eine eigene URL, und die Prüfung im Browser ist nur Bequemlichkeit.
 */
export async function saveAccountStatus(
  key: string,
  patch: AccountStatusPatch,
): Promise<{ ok: boolean }> {
  if (!KEY || !key.trim()) return { ok: false };

  const row: Record<string, string | number | null> = {
    account_key: key.trim().slice(0, 200),
    updated_at: new Date().toISOString(),
  };
  if (patch.state !== undefined) row.state = normalizeState(patch.state);
  if (patch.target_per_week !== undefined) row.target_per_week = clampInt(patch.target_per_week, 0, 100);
  if (patch.posts_manual !== undefined) row.posts_manual = clampInt(patch.posts_manual, 0, 1_000_000);
  if (patch.note !== undefined) {
    const n = (patch.note ?? "").trim().slice(0, 500);
    row.note = n || null;
  }

  try {
    const res = await fetch(REST, {
      method: "POST",
      headers: hdr({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(row),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

function clampInt(v: number | null, min: number, max: number): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.max(min, Math.min(max, Math.round(v)));
}
