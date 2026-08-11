// SERVER ONLY. Freie To-do-Liste für /admin/todos (Tabelle `klar_todos`,
// Migration 0014, im Klar-Hub-Supabase exiuwektrqxvycclqfdd).
//
// Bewusst dumm gehalten: Titel, Haken, Reihenfolge. Was sich aus echten Daten
// ableiten lässt — offene Collab-Anfragen, fällige Auszahlungen, stille Apps —
// steht bereits in der Arbeitsliste auf /admin/overview und gehört NICHT hier
// hinein, sonst pflegt man dieselbe Wahrheit zweimal. Hier landet, was sonst
// nur im Kopf ist.
import "server-only";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST = `${URL_BASE}/rest/v1/klar_todos`;

function hdr(extra?: HeadersInit): HeadersInit {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  done_at: string | null;
  /** Geplanter Tag als "YYYY-MM-DD", oder null für "irgendwann". */
  due_on: string | null;
  position: number;
  created_at: string;
}

export function todosConfigured(): boolean {
  return Boolean(KEY);
}

/**
 * Offene zuerst, darin Geplantes vor Ungeplantem und das früheste Datum oben,
 * danach die eigene Sortierung. `nullslast` ist der Punkt: ohne das stünden
 * die ungeplanten Punkte vor dem, was heute dran ist.
 */
export async function listTodos(limit = 200): Promise<Todo[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(
      `${REST}?select=*&order=done.asc,due_on.asc.nullslast,position.asc,created_at.desc&limit=${limit}`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Todo[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Nur die Anzahl offener Punkte — für die Zeile in der Arbeitsliste. */
export async function countOpenTodos(): Promise<number> {
  if (!KEY) return 0;
  try {
    const res = await fetch(`${REST}?select=id&done=is.false`, {
      headers: hdr({ Prefer: "count=exact", Range: "0-0" }),
      cache: "no-store",
    });
    if (!res.ok) return 0;
    // PostgREST liefert die Gesamtzahl im Content-Range-Header ("0-0/17").
    const total = (res.headers.get("content-range") ?? "").split("/")[1];
    return Number.isFinite(Number(total)) ? Number(total) : 0;
  } catch {
    return 0;
  }
}

/**
 * Neuer Punkt ganz oben. `position` wird kleiner als das aktuelle Minimum
 * gewählt, damit Einfügen nie die ganze Liste umschreiben muss.
 */
export async function addTodo(title: string): Promise<{ ok: boolean; error?: string }> {
  const clean = title.trim().slice(0, 500);
  if (!KEY) return { ok: false, error: "not configured" };
  if (!clean) return { ok: false, error: "empty" };
  try {
    const head = await fetch(`${REST}?select=position&order=position.asc&limit=1`, {
      headers: hdr(),
      cache: "no-store",
    });
    const first = head.ok ? ((await head.json()) as Todo[])[0] : undefined;
    const position = (first?.position ?? 0) - 1;
    const res = await fetch(REST, {
      method: "POST",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({ title: clean, position }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `insert ${res.status}` };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function setTodoDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  if (!KEY || !id) return { ok: false };
  try {
    const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({ done, done_at: done ? new Date().toISOString() : null }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export async function renameTodo(id: string, title: string): Promise<{ ok: boolean }> {
  const clean = title.trim().slice(0, 500);
  if (!KEY || !id || !clean) return { ok: false };
  try {
    const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({ title: clean }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/** Auf einen Tag legen ("YYYY-MM-DD") oder mit null wieder freigeben. */
export async function setTodoDue(id: string, due: string | null): Promise<{ ok: boolean }> {
  if (!KEY || !id) return { ok: false };
  // Nur echte Kalendertage durchlassen — der Wert kommt aus einem Formular.
  if (due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false };
  try {
    const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({ due_on: due }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/** Offene Punkte mit Tag — Quelle für den Kalender-Feed. */
export async function listPlannedTodos(limit = 500): Promise<Todo[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(
      `${REST}?select=*&done=is.false&due_on=not.is.null&order=due_on.asc&limit=${limit}`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Todo[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function deleteTodo(id: string): Promise<{ ok: boolean }> {
  if (!KEY || !id) return { ok: false };
  try {
    const res = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: hdr({ Prefer: "return=minimal" }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/** Alle erledigten Punkte wegräumen. Gibt die Anzahl gelöschter Zeilen zurück. */
export async function clearDoneTodos(): Promise<number> {
  if (!KEY) return 0;
  try {
    const res = await fetch(`${REST}?done=is.true`, {
      method: "DELETE",
      headers: hdr({ Prefer: "return=representation" }),
    });
    if (!res.ok) return 0;
    const rows = (await res.json()) as Todo[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}
