// SERVER ONLY. Das Referenzvideo je Ebene — `klar_channel_reference` im
// Klar-Hub-Supabase exiuwektrqxvycclqfdd, Migration 0030.
//
// Der Unterschied zu `lib/references`: dort liegt eine Bibliothek, aus der man
// auswaehlt. Hier haengt das Video direkt an der Ebene, und **das Hochladen ist
// die Zuordnung**. Kein Kennungsfeld, keine Liste.
//
// Drei Ebenen, sie erben nach unten:
//
//   basalt                      gilt fuer alle Basalt-Kanaele
//   basalt:tiktok               gilt fuer alle Basalt-TikToks
//   basalt:tiktok:realone9947   gilt fuer genau diesen Kanal
//
// Aufgeloest wird von unten nach oben, der spezifischste Treffer gewinnt. Das
// passt auf Alains Bestand: die drei Kelva-Kanaele fahren dasselbe, die zwei
// Basalt-Motivationskanaele auch. Einmal an der App hinterlegen statt dreimal
// am Kanal ist genau die Arbeit, die sonst jedes Mal wieder anfaellt.
//
// Der `scope` ist ein Praefix des `account_key` ("app:plattform:handle"), also
// ist die Aufloesung reines Abschneiden — es braucht keine zweite Landkarte,
// die jemand nachziehen muesste.
import "server-only";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST = `${URL_BASE}/rest/v1/klar_channel_reference`;
const BUCKET = "referenzen";
const STORAGE = `${URL_BASE}/storage/v1`;
const SIGN_SEKUNDEN = 3600;

function hdr(extra?: HeadersInit): HeadersInit {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface ChannelReference {
  id: number;
  scope: string;
  /** "YYYY-MM-DD" — seit wann dieses Video an der Ebene haengt. */
  ab: string;
  /** "YYYY-MM-DD" oder null, solange es laeuft. */
  bis: string | null;
  /** Warum vom alten Video weg. Steht an der Zeile, die endet. */
  grund: string | null;
  titel: string | null;
  notiz: string | null;
  video_pfad: string | null;
  video_link: string | null;
  kennung: string | null;
  /** Signierte Abspiel-URL, eine Stunde gueltig. Nicht in der Datenbank. */
  video_url: string | null;
}

export interface ChannelReferencePatch {
  titel?: string | null;
  notiz?: string | null;
  videoPfad?: string | null;
  videoLink?: string | null;
  kennung?: string | null;
  /** Nur bei einem Videowechsel: warum weg vom alten. */
  grund?: string | null;
}

/**
 * Womit man eine Datei anzeigt.
 *
 *   video   spielt im <video>-Tag
 *   bild    gehoert in ein <img>. Ein JPEG in einem <video> bleibt schwarz,
 *           und genau das war der Fehler, bis Alain am 2026-08-20 fragte, ob
 *           er auch Fotos hochladen kann.
 *   roh     da, aber im Browser nicht darstellbar — HEIC vom iPhone. Dafuer
 *           zeigt die Oberflaeche einen Verweis statt einer schwarzen Flaeche.
 */
export type MedienArt = "video" | "bild" | "roh";

const BILD = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const ROH = [".heic", ".heif"];

export function medienArt(pfadOderUrl: string | null | undefined): MedienArt {
  const p = (pfadOderUrl ?? "").toLowerCase().split("?")[0];
  if (ROH.some((e) => p.endsWith(e))) return "roh";
  if (BILD.some((e) => p.endsWith(e))) return "bild";
  return "video";
}

/** app | app:plattform | app:plattform:handle */
export const SCOPE_FORM = /^[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+){0,2}$/;

function clean(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

export function channelReferenceConfigured(): boolean {
  return Boolean(KEY);
}

/**
 * Die Ebenen eines Kanals, vom spezifischsten zum allgemeinsten.
 * `basalt:tiktok:realone9947` → ["basalt:tiktok:realone9947", "basalt:tiktok", "basalt"]
 */
export function scopeKette(accountKey: string): string[] {
  const teile = accountKey.split(":");
  const out: string[] = [];
  for (let i = teile.length; i >= 1; i--) out.push(teile.slice(0, i).join(":"));
  return out;
}

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
 * Die LAUFENDEN Ebenen (`bis is null`), nach `scope`, mit signierter Abspiel-URL.
 *
 * Geschlossene Zeilen bleiben in der Tabelle stehen und kommen hier nicht mit:
 * das Board zeigt, was gilt, und der Verlauf wird eigens geholt.
 */
export async function listChannelReferences(): Promise<Map<string, ChannelReference>> {
  const out = new Map<string, ChannelReference>();
  if (!KEY) return out;
  try {
    const res = await fetch(`${REST}?select=*&bis=is.null&order=scope.asc&limit=500`, {
      headers: hdr(),
      cache: "no-store",
    });
    if (!res.ok) return out;
    const rows = (await res.json()) as ChannelReference[];
    if (!Array.isArray(rows)) return out;
    const mitUrl = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        video_url: r.video_pfad ? await signiere(r.video_pfad) : null,
      })),
    );
    for (const r of mitUrl) out.set(r.scope, r);
    return out;
  } catch {
    return out;
  }
}

/**
 * Welche Referenz fuer einen Kanal gilt, und von welcher Ebene sie kommt.
 *
 * Eine Zeile zaehlt erst als hinterlegt, wenn sie tatsaechlich ein Video oder
 * einen Link traegt. Eine Zeile, in der nur eine Notiz steht, wuerde sonst die
 * Vererbung abschneiden und den Kanal ohne Referenz dastehen lassen, obwohl die
 * App eine hat.
 */
export function aufloesen(
  accountKey: string,
  alle: Map<string, ChannelReference>,
): { treffer: ChannelReference; ebene: string } | null {
  for (const scope of scopeKette(accountKey)) {
    const r = alle.get(scope);
    if (r && (r.video_pfad || r.video_link)) return { treffer: r, ebene: scope };
  }
  return null;
}

/**
 * Titel, Notiz oder Kennung der LAUFENDEN Zeile aendern.
 *
 * Kein Wechsel: einen Tippfehler im Titel zu richten ist keine Umorientierung
 * und darf keine Zeile im Verlauf erzeugen. Gibt es noch keine laufende Zeile,
 * wird eine angelegt — sonst haette eine Notiz nichts, woran sie haengt.
 */
export async function saveChannelReference(
  scope: string,
  patch: ChannelReferencePatch,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const s = scope.trim();
  if (!SCOPE_FORM.test(s)) return { ok: false, fehler: "unbekannte Ebene" };

  const row: Record<string, unknown> = {};
  if (patch.titel !== undefined) row.titel = clean(patch.titel, 120);
  if (patch.notiz !== undefined) row.notiz = clean(patch.notiz, 600);
  if (patch.kennung !== undefined) row.kennung = clean(patch.kennung, 200);
  // Ein neues Video ist ein Wechsel und laeuft ueber `wechsleVideo`.
  if (patch.videoPfad !== undefined || patch.videoLink !== undefined) {
    return wechsleVideo(s, {
      videoPfad: patch.videoPfad,
      videoLink: patch.videoLink,
      grund: patch.grund ?? null,
    });
  }
  if (!Object.keys(row).length) return { ok: true };

  try {
    const laufend = await fetch(
      `${REST}?select=id&scope=eq.${encodeURIComponent(s)}&bis=is.null&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    const zeilen = laufend.ok ? ((await laufend.json()) as { id: number }[]) : [];
    const alt = Array.isArray(zeilen) ? zeilen[0] : undefined;

    if (!alt) {
      const res = await fetch(REST, {
        method: "POST",
        headers: hdr({ Prefer: "return=minimal" }),
        body: JSON.stringify({ ...row, scope: s }),
      });
      return res.ok ? { ok: true } : { ok: false, fehler: `Datenbank antwortete ${res.status}` };
    }

    const res = await fetch(`${REST}?id=eq.${alt.id}`, {
      method: "PATCH",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify(row),
    });
    return res.ok ? { ok: true } : { ok: false, fehler: `Datenbank antwortete ${res.status}` };
  } catch {
    return { ok: false, fehler: "Datenbank nicht erreichbar" };
  }
}

/**
 * Ein neues Video an eine Ebene haengen: die laufende Zeile schliessen, eine
 * neue anlegen.
 *
 * Reihenfolge zaehlt — erst schliessen, dann anlegen. Andersherum laegen fuer
 * einen Moment zwei Zeilen mit `bis is null` vor, und der Unique-Index aus 0031
 * wiese das Anlegen ab.
 *
 * Titel und Notiz wandern mit: sie beschreiben meist die Ebene und nicht das
 * einzelne Video, und sie erneut tippen zu muessen waere Arbeit ohne Ertrag.
 */
export async function wechsleVideo(
  scope: string,
  opts: { videoPfad?: string | null; videoLink?: string | null; grund?: string | null },
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const s = scope.trim();
  if (!SCOPE_FORM.test(s)) return { ok: false, fehler: "unbekannte Ebene" };
  const tag = new Date().toISOString().slice(0, 10);

  try {
    const laufend = await fetch(
      `${REST}?select=*&scope=eq.${encodeURIComponent(s)}&bis=is.null&limit=1`,
      { headers: hdr(), cache: "no-store" },
    );
    const zeilen = laufend.ok ? ((await laufend.json()) as ChannelReference[]) : [];
    const alt = Array.isArray(zeilen) ? zeilen[0] : undefined;

    const neu = {
      scope: s,
      titel: alt?.titel ?? null,
      notiz: alt?.notiz ?? null,
      kennung: alt?.kennung ?? null,
      video_pfad: opts.videoPfad !== undefined ? clean(opts.videoPfad, 400) : alt?.video_pfad ?? null,
      video_link: opts.videoLink !== undefined ? clean(opts.videoLink, 500) : alt?.video_link ?? null,
      ab: tag,
    };

    // Nichts mehr dran? Dann ist es kein Wechsel, sondern ein Wegnehmen: die
    // laufende Zeile wird geschlossen und keine neue eroeffnet, damit die
    // Vererbung von der Ebene darueber wieder greift.
    const leer = !neu.video_pfad && !neu.video_link;

    if (alt) {
      const bis = alt.ab && String(alt.ab).slice(0, 10) > tag ? String(alt.ab).slice(0, 10) : tag;
      const zu = await fetch(`${REST}?id=eq.${alt.id}`, {
        method: "PATCH",
        headers: hdr({ Prefer: "return=minimal" }),
        body: JSON.stringify({ bis, grund: clean(opts.grund, 500) }),
      });
      if (!zu.ok) return { ok: false, fehler: `Schliessen fehlgeschlagen (${zu.status})` };
    }
    if (leer) return { ok: true };

    const res = await fetch(REST, {
      method: "POST",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify(neu),
    });
    return res.ok ? { ok: true } : { ok: false, fehler: `Datenbank antwortete ${res.status}` };
  } catch {
    return { ok: false, fehler: "Datenbank nicht erreichbar" };
  }
}

/**
 * Der Verlauf aller Ebenen eines Kanals, neueste zuerst.
 *
 * Alle drei Ebenen zusammen, weil ein Kanal auch dann betroffen ist, wenn das
 * Video an seiner App gewechselt hat — von seiner Warte aus ist das derselbe
 * Vorgang.
 */
export async function listChannelReferenceHistory(
  accountKey: string,
): Promise<ChannelReference[]> {
  if (!KEY || !accountKey.trim()) return [];
  const kette = scopeKette(accountKey);
  const inListe = kette.map((s) => `"${s}"`).join(",");
  try {
    const res = await fetch(
      `${REST}?select=*&scope=in.(${encodeURIComponent(inListe)})&order=ab.desc,id.desc&limit=100`,
      { headers: hdr(), cache: "no-store" },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as ChannelReference[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/**
 * Ein hochgeladenes Video an eine Ebene haengen.
 *
 * Der Pfad traegt den Scope, damit im Bucket erkennbar bleibt, wozu eine Datei
 * gehoert. Doppelpunkte gehen dabei in Unterstriche ueber: sie sind in
 * Objektpfaden unnoetig heikel, und der Scope bleibt trotzdem lesbar.
 */
export async function uploadChannelVideo(
  scope: string,
  bytes: ArrayBuffer,
  contentType: string,
  dateiname: string,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const s = scope.trim();
  if (!SCOPE_FORM.test(s)) return { ok: false, fehler: "unbekannte Ebene" };

  const treffer = /\.[a-z0-9]{1,5}$/i.exec(dateiname);
  const endung = (treffer ? treffer[0] : "").toLowerCase();
  const pfad = `kanal/${s.replace(/:/g, "_")}/referenz${endung || ".mp4"}`;
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
    return wechsleVideo(s, { videoPfad: pfad, grund: null });
  } catch {
    return { ok: false, fehler: "Upload fehlgeschlagen" };
  }
}

/**
 * Das Video einer Ebene wegnehmen.
 *
 * Die laufende Zeile wird geschlossen, nicht geloescht: sie ist der Beleg, dass
 * dort einmal etwas lief. Danach greift die Vererbung von der Ebene darueber
 * wieder. Die Datei im Bucket bleibt bewusst liegen — der Verlauf zeigt sonst
 * auf ein Video, das niemand mehr ansehen kann.
 */
export async function removeChannelVideo(
  scope: string,
  grund?: string | null,
): Promise<{ ok: boolean }> {
  const res = await wechsleVideo(scope, { videoPfad: null, videoLink: null, grund: grund ?? null });
  return { ok: res.ok };
}
