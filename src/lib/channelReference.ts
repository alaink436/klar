// SERVER ONLY. Die Referenz je Ebene — `klar_channel_reference` im
// Klar-Hub-Supabase exiuwektrqxvycclqfdd, Migrationen 0030 bis 0034.
//
// Der Unterschied zu `lib/references`: dort liegt eine Bibliothek, aus der man
// auswaehlt. Hier haengt die Referenz direkt an der Ebene, und **das Hochladen
// ist die Zuordnung**. Kein Kennungsfeld, keine Liste.
//
// Drei Ebenen, sie erben nach unten:
//
//   basalt                      gilt fuer alle Basalt-Kanaele
//   basalt:tiktok               gilt fuer alle Basalt-TikToks
//   basalt:tiktok:realone9947   gilt fuer genau diesen Kanal
//
// Aufgeloest wird von unten nach oben, der spezifischste Treffer gewinnt. Das
// passt auf Alains Bestand: die drei Kelva-Kanaele fahren dasselbe, die zwei
// Basalt-Motivationskanaele auch.
//
// Seit 0034 sind es **mehrere Dateien** je Ebene, in Reihenfolge. Eine
// Slideshow ist zwei bis zehn Bilder, kein Video; die Reihenfolge ist dabei die
// Information, und ein Array haelt sie ohne Sortierspalte.
//
// Ein Wechsel ist kein Ueberschreiben: die laufende Zeile wird mit Datum und
// Grund geschlossen (0031) und bleibt im Verlauf sichtbar.
import "server-only";

const URL_BASE =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const REST = `${URL_BASE}/rest/v1/klar_channel_reference`;
const BUCKET = "referenzen";
const STORAGE = `${URL_BASE}/storage/v1`;
/** Wie lange eine Abspiel-URL gilt. Eine Stunde reicht fuer eine Sitzung am Board. */
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

/**
 * Womit man eine Datei anzeigt.
 *
 *   video   spielt im <video>-Tag
 *   bild    gehoert in ein <img>. Ein JPEG in einem <video> bleibt schwarz.
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

/** Eine anzeigbare Datei: signierte Adresse plus wie sie darzustellen ist. */
export interface Medium {
  url: string;
  art: MedienArt;
}

export interface ChannelReference {
  id: number;
  scope: string;
  /** "YYYY-MM-DD" — seit wann diese Referenz an der Ebene haengt. */
  ab: string;
  /** "YYYY-MM-DD" oder null, solange sie laeuft. */
  bis: string | null;
  /** Warum von der alten weg. Steht an der Zeile, die endet. */
  grund: string | null;
  titel: string | null;
  notiz: string | null;
  /** Pfade im Bucket, in Anzeigereihenfolge. Bei einer Slideshow mehrere. */
  dateien: string[];
  /** Adresse des Originals (TikTok-Post, Drive). */
  video_link: string | null;
  kennung: string | null;
  /**
   * Frisch signierte Adressen zu `dateien`, gueltig eine Stunde. Nicht in der
   * Datenbank: der Bucket ist privat, und eine gespeicherte Adresse waere
   * entweder abgelaufen oder fuer immer offen.
   */
  medien: Medium[];
}

export interface ChannelReferencePatch {
  titel?: string | null;
  notiz?: string | null;
  videoLink?: string | null;
  kennung?: string | null;
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

/**
 * Signierte Adressen fuer eine Liste von Pfaden, in derselben Reihenfolge.
 *
 * Parallel, weil eine Slideshow schnell zehn Dateien hat und zehn Anfragen
 * nacheinander spuerbar waeren. Ein Pfad, der ins Leere zeigt, faellt raus:
 * eine tote Adresse waere schlimmer als eine fehlende, weil die Kachel dann
 * stumm schwarz bliebe.
 */
export async function signiereAlle(pfade: string[]): Promise<Medium[]> {
  const roh = await Promise.all(
    pfade.map(async (pfad) => {
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
        return {
          url: `${STORAGE}${rel.startsWith("/") ? "" : "/"}${rel}`,
          art: medienArt(pfad),
        };
      } catch {
        return null;
      }
    }),
  );
  return roh.filter((m): m is Medium => m !== null);
}

/** Die LAUFENDEN Ebenen (`bis is null`), nach `scope`, mit signierten Adressen. */
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
    const mitMedien = await Promise.all(
      rows.map(async (r) => {
        const dateien = Array.isArray(r.dateien) ? r.dateien : [];
        return { ...r, dateien, medien: await signiereAlle(dateien) };
      }),
    );
    for (const r of mitMedien) out.set(r.scope, r);
    return out;
  } catch {
    return out;
  }
}

/**
 * Welche Referenz fuer einen Kanal gilt, und von welcher Ebene sie kommt.
 *
 * Eine Zeile zaehlt erst als hinterlegt, wenn wirklich Dateien oder ein Link
 * dranhaengen. Eine Zeile, in der nur eine Notiz steht, wuerde sonst die
 * Vererbung abschneiden und den Kanal ohne Referenz dastehen lassen, obwohl die
 * App eine hat.
 */
export function aufloesen(
  accountKey: string,
  alle: Map<string, ChannelReference>,
): { treffer: ChannelReference; ebene: string } | null {
  for (const scope of scopeKette(accountKey)) {
    const r = alle.get(scope);
    if (r && (r.dateien.length > 0 || r.video_link)) return { treffer: r, ebene: scope };
  }
  return null;
}

/**
 * Titel, Notiz, Link oder Kennung der LAUFENDEN Zeile aendern.
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
  if (patch.videoLink !== undefined) row.video_link = clean(patch.videoLink, 500);
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
 * Neue Dateien an eine Ebene haengen: die laufende Zeile schliessen, eine neue
 * anlegen.
 *
 * Reihenfolge zaehlt — erst schliessen, dann anlegen. Andersherum laegen fuer
 * einen Moment zwei Zeilen mit `bis is null` vor, und der Unique-Index aus 0031
 * wiese das Anlegen ab.
 *
 * Titel, Notiz und Link wandern mit: sie beschreiben meist die Ebene und nicht
 * die einzelne Datei, und sie erneut zu tippen waere Arbeit ohne Ertrag.
 */
export async function wechsleDateien(
  scope: string,
  dateien: string[],
  grund?: string | null,
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

    // Keine Dateien und kein Link mehr? Dann ist es kein Wechsel, sondern ein
    // Wegnehmen: die laufende Zeile wird geschlossen und keine neue eroeffnet,
    // damit die Vererbung von der Ebene darueber wieder greift.
    const leer = dateien.length === 0 && !alt?.video_link;

    if (alt) {
      const bis = alt.ab && String(alt.ab).slice(0, 10) > tag ? String(alt.ab).slice(0, 10) : tag;
      const zu = await fetch(`${REST}?id=eq.${alt.id}`, {
        method: "PATCH",
        headers: hdr({ Prefer: "return=minimal" }),
        body: JSON.stringify({ bis, grund: clean(grund, 500) }),
      });
      if (!zu.ok) return { ok: false, fehler: `Schliessen fehlgeschlagen (${zu.status})` };
    }
    if (leer) return { ok: true };

    const res = await fetch(REST, {
      method: "POST",
      headers: hdr({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        scope: s,
        titel: alt?.titel ?? null,
        notiz: alt?.notiz ?? null,
        kennung: alt?.kennung ?? null,
        video_link: alt?.video_link ?? null,
        dateien,
        ab: tag,
      }),
    });
    return res.ok ? { ok: true } : { ok: false, fehler: `Datenbank antwortete ${res.status}` };
  } catch {
    return { ok: false, fehler: "Datenbank nicht erreichbar" };
  }
}

/** Der Verlauf aller Ebenen eines Kanals, neueste zuerst. */
export async function listChannelReferenceHistory(
  accountKey: string,
): Promise<ChannelReference[]> {
  if (!KEY || !accountKey.trim()) return [];
  const inListe = scopeKette(accountKey)
    .map((s) => `"${s}"`)
    .join(",");
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

/** Eine Datei in den Bucket legen und ihren Pfad zurueckgeben. */
export async function legeAb(
  ordner: string,
  name: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  if (!KEY) return null;
  const pfad = `${ordner}/${name}`;
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
    return res.ok ? pfad : null;
  } catch {
    return null;
  }
}

/** Name mit Endung, sonst `.mp4` — der Bucket prueft den Typ. */
export function mitEndung(basis: string, dateiname: string): string {
  const treffer = /\.[a-z0-9]{1,5}$/i.exec(dateiname);
  return `${basis}${(treffer ? treffer[0] : ".mp4").toLowerCase()}`;
}

/**
 * Mehrere Dateien an eine Ebene haengen — der Weg fuer eine Slideshow.
 *
 * Der Ordner traegt den Scope, damit im Bucket erkennbar bleibt, wozu etwas
 * gehoert, und das Datum des Wechsels. Die laufende Nummer haelt die
 * Reihenfolge der Slides. Beides zusammen sorgt dafuer, dass eine zweite Runde
 * die erste nicht ueberschreibt — der Verlauf zeigt sonst auf Dateien, die es
 * nicht mehr gibt.
 */
export async function uploadChannelFiles(
  scope: string,
  dateien: { bytes: ArrayBuffer; contentType: string; name: string }[],
  grund?: string | null,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const s = scope.trim();
  if (!SCOPE_FORM.test(s)) return { ok: false, fehler: "unbekannte Ebene" };
  if (!dateien.length) return { ok: false, fehler: "keine Datei" };

  const ordner = `kanal/${s.replace(/:/g, "_")}/${new Date().toISOString().slice(0, 10)}`;
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
  return wechsleDateien(s, pfade, grund ?? null);
}

/**
 * Die Dateien einer Ebene wegnehmen.
 *
 * Die laufende Zeile wird geschlossen, nicht geloescht: sie ist der Beleg, dass
 * dort einmal etwas lief. Danach greift die Vererbung von der Ebene darueber
 * wieder. Die Dateien im Bucket bleiben bewusst liegen — der Verlauf zeigt
 * sonst auf etwas, das niemand mehr ansehen kann.
 */
export async function removeChannelVideo(
  scope: string,
  grund?: string | null,
): Promise<{ ok: boolean }> {
  const res = await wechsleDateien(scope, [], grund ?? null);
  return { ok: res.ok };
}
