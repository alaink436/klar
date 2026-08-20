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
  scope: string;
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

/** Alle hinterlegten Ebenen, nach `scope`, mit frisch signierter Abspiel-URL. */
export async function listChannelReferences(): Promise<Map<string, ChannelReference>> {
  const out = new Map<string, ChannelReference>();
  if (!KEY) return out;
  try {
    const res = await fetch(`${REST}?select=*&order=scope.asc&limit=500`, {
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

/** Anlegen oder aendern. Der `scope` ist der Schluessel und wird nie umgeschrieben. */
export async function saveChannelReference(
  scope: string,
  patch: ChannelReferencePatch,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!KEY) return { ok: false, fehler: "nicht konfiguriert" };
  const s = scope.trim();
  if (!SCOPE_FORM.test(s)) return { ok: false, fehler: "unbekannte Ebene" };

  const row: Record<string, unknown> = { scope: s };
  if (patch.titel !== undefined) row.titel = clean(patch.titel, 120);
  if (patch.notiz !== undefined) row.notiz = clean(patch.notiz, 600);
  if (patch.videoPfad !== undefined) row.video_pfad = clean(patch.videoPfad, 400);
  if (patch.videoLink !== undefined) row.video_link = clean(patch.videoLink, 500);
  if (patch.kennung !== undefined) row.kennung = clean(patch.kennung, 200);

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
    return saveChannelReference(s, { videoPfad: pfad });
  } catch {
    return { ok: false, fehler: "Upload fehlgeschlagen" };
  }
}

/**
 * Das Video einer Ebene wegnehmen. Bleibt danach nichts uebrig — kein Link,
 * kein Titel, keine Notiz — wird die Zeile geloescht, damit sie die Vererbung
 * nicht laenger als leerer Eintrag blockiert.
 */
export async function removeChannelVideo(scope: string): Promise<{ ok: boolean }> {
  if (!KEY) return { ok: false };
  const s = scope.trim();
  try {
    const jetzt = await fetch(`${REST}?select=*&scope=eq.${encodeURIComponent(s)}&limit=1`, {
      headers: hdr(),
      cache: "no-store",
    });
    const rows = jetzt.ok ? ((await jetzt.json()) as ChannelReference[]) : [];
    const zeile = Array.isArray(rows) ? rows[0] : undefined;
    if (zeile?.video_pfad) {
      await fetch(`${STORAGE}/object/${BUCKET}/${encodeURI(zeile.video_pfad)}`, {
        method: "DELETE",
        headers: hdr(),
      });
    }
    const leerDanach = !zeile?.video_link && !zeile?.titel && !zeile?.notiz && !zeile?.kennung;
    if (leerDanach) {
      const res = await fetch(`${REST}?scope=eq.${encodeURIComponent(s)}`, {
        method: "DELETE",
        headers: hdr({ Prefer: "return=minimal" }),
      });
      return { ok: res.ok };
    }
    const res = await saveChannelReference(s, { videoPfad: null });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
