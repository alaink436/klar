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
const BUCKET = "referenzen";
const STORAGE = `${URL_BASE}/storage/v1`;
/** Wie lange eine Abspiel-URL gilt. Eine Stunde reicht fuer eine Sitzung am Board. */
const SIGN_SEKUNDEN = 3600;

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
  /** Pfad im privaten Bucket, wenn eine Datei hochgeladen wurde. */
  video_pfad: string | null;
  /** Adresse des Originals (TikTok-Post, Drive). */
  video_link: string | null;
  /**
   * Frisch signierte Abspiel-URL, gueltig eine Stunde. Steht nicht in der
   * Datenbank: der Bucket ist privat, und eine gespeicherte Adresse waere
   * entweder abgelaufen oder fuer immer offen.
   */
  video_url: string | null;
}

export interface ReferencePatch {
  titel?: string;
  herkunft?: string | null;
  notiz?: string | null;
  ablage?: string | null;
  aktiv?: boolean;
  videoPfad?: string | null;
  videoLink?: string | null;
}

function clean(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

export function referencesConfigured(): boolean {
  return Boolean(KEY);
}

/**
 * Eine Abspiel-URL fuer ein Objekt im privaten Bucket, gueltig eine Stunde.
 * `null`, wenn der Pfad ins Leere zeigt: eine tote Adresse waere schlimmer als
 * gar keine, weil der Spieler dann stumm schwarz bliebe.
 */
async function signiere(pfad: string): Promise<string | null> {
  try {
    const res = await fetch(`${STORAGE}/object/sign/${BUCKET}/${encodeURI(pfad)}`, {
      method: "POST",
      headers: hdr(),
      body: JSON.stringify({ expiresIn: SIGN_SEKUNDEN }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const rel = j.signedURL ?? j.signedUrl;
    if (!rel) return null;
    return `${STORAGE}${rel.startsWith("/") ? "" : "/"}${rel}`;
  } catch {
    return null;
  }
}

/**
 * Alle Referenzen nach Kennung, mit frisch signierter Abspiel-URL.
 *
 * Die Signaturen entstehen bei jedem Seitenaufruf neu und laufen parallel: bei
 * zwoelf Referenzen sind das zwoelf kurze Anfragen, nacheinander waeren sie
 * spuerbar. Referenzen ohne hochgeladene Datei kosten gar nichts.
 */
export async function listReferences(): Promise<Reference[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(
      `${REST}?select=kennung,titel,herkunft,notiz,ablage,aktiv,video_pfad,video_link&order=kennung.asc&limit=500`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Reference[];
    if (!Array.isArray(rows)) return [];
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        aktiv: r.aktiv !== false,
        video_url: r.video_pfad ? await signiere(r.video_pfad) : null,
      })),
    );
  } catch {
    return [];
  }
}

export interface ReferenceUse {
  account_key: string;
  richtung: string;
}

/**
 * Welche Kanaele eine Referenz gerade fahren, nach Kennung.
 *
 * Das ist die Verbindung zum Posting-Reiter: im Referenz-Reiter steht damit an
 * jeder Zeile, wer sie benutzt, statt dass jemand beide Listen im Kopf
 * abgleicht. Nur laufende Richtungen (`bis is null`) — wer eine Referenz vor
 * drei Wochen einmal gefahren ist, benutzt sie heute nicht.
 */
export async function listReferenceUsage(): Promise<Record<string, ReferenceUse[]>> {
  const out: Record<string, ReferenceUse[]> = {};
  if (!KEY) return out;
  try {
    const res = await fetch(
      `${URL_BASE}/rest/v1/klar_account_direction` +
        `?select=account_key,richtung,referenz&bis=is.null&referenz=not.is.null&limit=500`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return out;
    const rows = (await res.json()) as (ReferenceUse & { referenz: string })[];
    if (!Array.isArray(rows)) return out;
    for (const r of rows) {
      (out[r.referenz] ??= []).push({ account_key: r.account_key, richtung: r.richtung });
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Eine hochgeladene Datei in den Bucket legen und den Pfad an die Referenz
 * schreiben.
 *
 * Der Pfad traegt die Kennung, damit im Bucket erkennbar bleibt, wozu eine
 * Datei gehoert. `x-upsert` erlaubt das Ersetzen ohne vorheriges Loeschen —
 * sonst stuende die Referenz zwischen zwei Klicks ohne Video da.
 */
export async function uploadReferenceVideo(
  kennung: string,
  bytes: ArrayBuffer,
  contentType: string,
  dateiname: string,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const k = kennung.trim().toLowerCase();
  if (!KENNUNG_FORM.test(k)) return { ok: false, fehler: "unbekannte Kennung" };

  const treffer = /\.[a-z0-9]{1,5}$/i.exec(dateiname);
  const endung = (treffer ? treffer[0] : "").toLowerCase();
  const pfad = `${k}/video${endung || ".mp4"}`;
  try {
    const res = await fetch(`${STORAGE}/object/${BUCKET}/${encodeURI(pfad)}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": contentType || "application/octet-stream",
        "x-upsert": "true",
      },
      body: Buffer.from(bytes),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, fehler: `Upload ${res.status}: ${text.slice(0, 160)}` };
    }
    return saveReference(k, { videoPfad: pfad });
  } catch {
    return { ok: false, fehler: "Upload fehlgeschlagen" };
  }
}

/** Die hochgeladene Datei wegnehmen. Die Referenz selbst bleibt stehen. */
export async function removeReferenceVideo(kennung: string): Promise<{ ok: boolean }> {
  if (!KEY) return { ok: false };
  const k = kennung.trim().toLowerCase();
  try {
    const jetzt = await fetch(
      `${REST}?select=video_pfad&kennung=eq.${encodeURIComponent(k)}&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    const rows = jetzt.ok ? ((await jetzt.json()) as { video_pfad: string | null }[]) : [];
    const pfad = Array.isArray(rows) && rows[0] ? rows[0].video_pfad : null;
    if (pfad) {
      await fetch(`${STORAGE}/object/${BUCKET}/${encodeURI(pfad)}`, {
        method: "DELETE",
        headers: hdr(),
      });
    }
    const res = await saveReference(k, { videoPfad: null });
    return { ok: res.ok };
  } catch {
    return { ok: false };
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
  if (patch.videoPfad !== undefined) row.video_pfad = clean(patch.videoPfad, 400);
  if (patch.videoLink !== undefined) row.video_link = clean(patch.videoLink, 500);
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
