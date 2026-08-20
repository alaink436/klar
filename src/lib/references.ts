// SERVER ONLY. Die Referenzvideos — `klar_reference` im Klar-Hub-Supabase
// exiuwektrqxvycclqfdd, Migration 0028.
//
// Bis 0027 kam die Auswahlliste aus `lib/referenceIds.ts`, erzeugt aus dem
// AI-Brain. Alain konnte auswaehlen, aber nichts anlegen — und eine Referenz,
// die ihm gerade auffaellt, haette einen Umweg ueber den Vault gebraucht.
// Jetzt ist das Board die Quelle dafuer, WELCHE Referenzen es gibt.
//
// Was hier NICHT steht: wie das Video aufgebaut ist. Laenge, Schnittliste,
// Kameraführung und Kontaktbogen misst ein Agent und schreibt sie ins
// Vault-Manifest (`Projects/<Projekt>/Content/REFERENZEN.md`). Beides in einer
// Oberflaeche zu pflegen hiesse, zwei Fassungen derselben Sache zu haben.
// `AI-Brain/Projects/Klar-Content-Pipeline/KANAELE.md` fuegt sie zusammen.
//
// Schreiben geht nur ueber diese Route: ein Trigger aus 0028 weist Schreib-
// zugriffe von direkten Datenbankverbindungen ab. Agenten lesen, Alain schreibt.
import "server-only";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST = `${URL_BASE}/rest/v1/klar_reference`;

/** `<projekt>/<id>` — dieselbe Form wie im Vault-Manifest. */
export const KENNUNG_FORM = /^[a-z0-9._-]+\/[a-zA-Z0-9._-]+$/;

function hdr(extra?: HeadersInit): HeadersInit {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface Reference {
  kennung: string;
  titel: string;
  herkunft: string | null;
  notiz: string | null;
  ablage: string | null;
  aktiv: boolean;
}

export interface ReferencePatch {
  titel?: string;
  herkunft?: string | null;
  notiz?: string | null;
  ablage?: string | null;
  aktiv?: boolean;
}

function clean(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

export function referencesConfigured(): boolean {
  return Boolean(KEY);
}

/** Alle Referenzen, aktive zuerst, dann nach Kennung. */
export async function listReferences(): Promise<Reference[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(`${REST}?select=kennung,titel,herkunft,notiz,ablage,aktiv&order=kennung.asc&limit=500`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Reference[];
    return Array.isArray(rows) ? rows.map((r) => ({ ...r, aktiv: r.aktiv !== false })) : [];
  } catch {
    return [];
  }
}

/**
 * Anlegen oder aendern. Die Kennung ist der Schluessel und wird nie umgeschrieben
 * — sie steht in `klar_account_direction.referenz` und im Vault-Manifest, ein
 * Umbenennen wuerde beide Zeiger ins Leere laufen lassen. Wer sich vertippt hat,
 * legt neu an und setzt die alte auf inaktiv.
 */
export async function saveReference(
  kennung: string,
  patch: ReferencePatch,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const k = kennung.trim().toLowerCase();
  if (!KENNUNG_FORM.test(k)) {
    return { ok: false, fehler: "Kennung muss die Form <projekt>/<id> haben, z. B. basalt/avow-gym-fyp" };
  }

  const row: Record<string, unknown> = { kennung: k };
  if (patch.titel !== undefined) row.titel = clean(patch.titel, 120) ?? k;
  if (patch.herkunft !== undefined) row.herkunft = clean(patch.herkunft, 200);
  if (patch.notiz !== undefined) row.notiz = clean(patch.notiz, 600);
  if (patch.ablage !== undefined) row.ablage = clean(patch.ablage, 300);
  if (patch.aktiv !== undefined) row.aktiv = Boolean(patch.aktiv);
  // Beim Anlegen braucht die Zeile einen Titel, sonst steht sie namenlos da.
  if (row.titel === undefined) row.titel = k;

  try {
    const res = await fetch(REST, {
      method: "POST",
      headers: hdr({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(row),
    });
    return res.ok ? { ok: true } : { ok: false, fehler: `Datenbank antwortete ${res.status}` };
  } catch {
    return { ok: false, fehler: "Datenbank nicht erreichbar" };
  }
}

/**
 * Entfernen. Zeigt noch eine Richtung darauf, wird die Referenz nur auf inaktiv
 * gesetzt statt geloescht — sonst stuende in der Richtung eine Kennung, zu der
 * es nichts mehr gibt, und niemand wuesste mehr, was dort gemeint war.
 */
export async function removeReference(kennung: string): Promise<{ ok: boolean; behalten?: boolean }> {
  if (!KEY || !kennung.trim()) return { ok: false };
  const k = kennung.trim();
  try {
    const benutzt = await fetch(
      `${URL_BASE}/rest/v1/klar_account_direction?select=account_key&referenz=eq.${encodeURIComponent(k)}&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    const zeilen = benutzt.ok ? ((await benutzt.json()) as unknown[]) : [];
    if (Array.isArray(zeilen) && zeilen.length > 0) {
      const res = await saveReference(k, { aktiv: false });
      return { ok: res.ok, behalten: true };
    }
    const res = await fetch(`${REST}?kennung=eq.${encodeURIComponent(k)}`, {
      method: "DELETE",
      headers: hdr({ Prefer: "return=minimal" }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
