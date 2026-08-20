// SERVER ONLY. Eigene Posts, die konvertiert haben — `klar_post_sample` im
// Klar-Hub-Supabase exiuwektrqxvycclqfdd, Migration 0032.
//
// Das Gegenstueck zur Referenz. `lib/channelReference` haelt das FREMDE Video,
// dessen Machart wir uebernehmen: genau eines je Ebene, mit Verlauf. Hier liegt
// der EIGENE Post, der gelaufen ist: beliebig viele je Kanal, nebeneinander.
//
//   Referenz   „wonach bauen wir"      → einer gilt, der Rest ist Geschichte
//   Post       „was lief hier schon"   → alle gelten nebeneinander
//
// Deshalb wird hier auch anders aufgeloest: ein Kanal zeigt seine eigenen Posts
// UND die seiner App und Plattform, statt nur den spezifischsten Treffer. Bei
// einer Sammlung ist mehr richtig; bei einer Referenz waere mehr mehrdeutig.
//
// Das wichtigste Feld ist `notiz`: Alains Anweisung, worauf sich kuenftige Posts
// beziehen sollen. Ohne sie waere die Zeile nur ein Video.
import "server-only";
import {
  legeAb,
  mitEndung,
  scopeKette,
  signiereAlle,
  SCOPE_FORM,
  type Medium,
} from "./channelReference";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST = `${URL_BASE}/rest/v1/klar_post_sample`;

function hdr(extra?: HeadersInit): HeadersInit {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface PostSample {
  id: number;
  scope: string;
  titel: string | null;
  /** Alains Anweisung: worauf sich kuenftige Posts beziehen sollen. */
  notiz: string | null;
  /** Pfade im Bucket, in Reihenfolge. Ein Carousel bringt mehrere mit. */
  dateien: string[];
  video_link: string | null;
  gepostet_am: string | null;
  ergebnis: string | null;
  aktiv: boolean;
  /** Frisch signierte Adressen zu `dateien`, eine Stunde gueltig. */
  medien: Medium[];
}

export interface PostSamplePatch {
  titel?: string | null;
  notiz?: string | null;
  videoLink?: string | null;
  gepostetAm?: string | null;
  ergebnis?: string | null;
  aktiv?: boolean;
}

function clean(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim();
  return s ? s.slice(0, max) : null;
}


/** Alle aktiven Posts, nach `scope`. Neueste zuerst. */
export async function listPostSamples(): Promise<Map<string, PostSample[]>> {
  const out = new Map<string, PostSample[]>();
  if (!KEY) return out;
  try {
    const res = await fetch(`${REST}?select=*&aktiv=is.true&order=angelegt_am.desc&limit=500`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return out;
    const rows = (await res.json()) as PostSample[];
    if (!Array.isArray(rows)) return out;
    const mitUrl = await Promise.all(
      rows.map(async (r) => {
        const dateien = Array.isArray(r.dateien) ? r.dateien : [];
        return { ...r, dateien, medien: await signiereAlle(dateien) };
      }),
    );
    for (const r of mitUrl) {
      const liste = out.get(r.scope) ?? [];
      liste.push(r);
      out.set(r.scope, liste);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Die Posts, die fuer einen Kanal gelten: seine eigenen plus die seiner
 * Plattform und seiner App. Gesammelt, nicht der spezifischste Treffer — was
 * auf einem Kelva-Kanal lief, ist auch fuer die anderen beiden das Vorbild.
 */
export function fuerKanal(accountKey: string, alle: Map<string, PostSample[]>): PostSample[] {
  const out: PostSample[] = [];
  for (const scope of scopeKette(accountKey)) out.push(...(alle.get(scope) ?? []));
  return out;
}

/**
 * Einen Post anlegen und seine id zurueckgeben.
 *
 * Die id wird gebraucht, bevor die Datei im Bucket landet: der Objektpfad
 * traegt sie, damit zwei Posts desselben Kanals sich nicht ueberschreiben.
 * Deshalb `return=representation` statt `minimal`.
 */
export async function createPostSample(
  scope: string,
  patch: PostSamplePatch = {},
): Promise<{ ok: boolean; id?: number; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const s = scope.trim();
  if (!SCOPE_FORM.test(s)) return { ok: false, fehler: "unbekannte Ebene" };
  try {
    const res = await fetch(REST, {
      method: "POST",
      headers: hdr({ Prefer: "return=representation" }),
      body: JSON.stringify({
        scope: s,
        titel: clean(patch.titel, 120),
        notiz: clean(patch.notiz, 800),
        video_link: clean(patch.videoLink, 500),
        ergebnis: clean(patch.ergebnis, 200),
      }),
    });
    if (!res.ok) return { ok: false, fehler: `Datenbank antwortete ${res.status}` };
    const rows = (await res.json()) as { id: number }[];
    const id = Array.isArray(rows) ? rows[0]?.id : undefined;
    return id ? { ok: true, id } : { ok: false, fehler: "keine id zurueck" };
  } catch {
    return { ok: false, fehler: "Datenbank nicht erreichbar" };
  }
}

/** Felder eines Posts aendern. Kein Verlauf: eine Sammlung hat keinen. */
export async function savePostSample(
  id: number,
  patch: PostSamplePatch,
): Promise<{ ok: boolean }> {
  if (!KEY || !Number.isFinite(id)) return { ok: false };
  const row: Record<string, unknown> = {};
  if (patch.titel !== undefined) row.titel = clean(patch.titel, 120);
  if (patch.notiz !== undefined) row.notiz = clean(patch.notiz, 800);
  if (patch.videoLink !== undefined) row.video_link = clean(patch.videoLink, 500);
  if (patch.ergebnis !== undefined) row.ergebnis = clean(patch.ergebnis, 200);
  if (patch.gepostetAm !== undefined) row.gepostet_am = clean(patch.gepostetAm, 10);
  if (patch.aktiv !== undefined) row.aktiv = Boolean(patch.aktiv);
  if (!Object.keys(row).length) return { ok: true };
  try {
    const res = await fetch(`${REST}?id=eq.${id}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify(row),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Einen Post hochladen: erst die Zeile, dann ihre Dateien.
 *
 * Die id wird zuerst gebraucht — sie traegt den Ordner, damit zwei Posts
 * desselben Kanals sich nicht ueberschreiben. Ein Carousel bringt mehrere
 * Dateien mit, die laufende Nummer haelt ihre Reihenfolge.
 *
 * Scheitert der Upload, bleibt die Zeile stehen und traegt keine Datei. Das ist
 * die bessere Haelfte: Alains Notiz — die Anweisung, worauf man sich beziehen
 * soll — ist auch ohne Datei etwas wert, und er kann sie nachreichen.
 */
export async function uploadPostSample(
  scope: string,
  dateien: { bytes: ArrayBuffer; contentType: string; name: string }[],
  patch: PostSamplePatch = {},
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const angelegt = await createPostSample(scope, patch);
  if (!angelegt.ok || !angelegt.id) return { ok: false, fehler: angelegt.fehler };
  if (!dateien.length) return { ok: true };

  const ordner = `posts/${scope.trim().replace(/:/g, "_")}/${angelegt.id}`;
  const pfade: string[] = [];
  for (let i = 0; i < dateien.length; i++) {
    const d = dateien[i];
    const pfad = await legeAb(
      ordner,
      mitEndung(String(i + 1).padStart(2, "0"), d.name),
      d.bytes,
      d.contentType,
    );
    if (!pfad) return { ok: false, fehler: `Upload von ${d.name} fehlgeschlagen` };
    pfade.push(pfad);
  }

  try {
    const zu = await fetch(`${REST}?id=eq.${angelegt.id}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({ dateien: pfade }),
    });
    return zu.ok ? { ok: true } : { ok: false, fehler: "Pfade konnten nicht gespeichert werden" };
  } catch {
    return { ok: false, fehler: "Speichern fehlgeschlagen" };
  }
}

/** Die hochgeladenen Pfade an einem Post festhalten. */
export async function setPostFiles(id: number, pfade: string[]): Promise<{ ok: boolean }> {
  if (!KEY || !Number.isFinite(id)) return { ok: false };
  try {
    const res = await fetch(`${REST}?id=eq.${id}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({ dateien: pfade }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Einen Post aus der Sammlung nehmen. Er wird auf inaktiv gesetzt, nicht
 * geloescht: ein Post, der einmal lief, bleibt ein Beleg, auch wenn er nicht
 * mehr das Vorbild sein soll.
 */
export async function archivePostSample(id: number): Promise<{ ok: boolean }> {
  return savePostSample(id, { aktiv: false });
}
