// SERVER ONLY. Der Draht zu MyCakeDay (www.mycakeday.ch).
//
// Klar Control zeigt das Postfach von MyCakeDay unter /admin/mycakeday und
// antwortet von dort. Die Daten kommen NICHT aus der Cakeday-Datenbank,
// sondern aus einer kleinen Betriebs-API auf mycakeday.ch (`/api/klar/*`):
// dort wird fremdes Mail-HTML gesaeubert, das Zitat abgetrennt und der
// Absendername geputzt. Wer die Datenbank direkt laese, bekaeme rohes HTML
// von Fremden in eine Admin-Sitzung — genau das, was die Saeuberung
// verhindert. Deshalb geht alles durch die API, auch die Ungelesen-Zahl.
//
// Env:
//   CAKEDAY_KLAR_SECRET — der Bearer. Dasselbe Geheimnis steht auf Vercel von
//                         mycakeday.ch als CAKEDAY_KLAR_SECRET.
//   CAKEDAY_URL         — optional, Vorgabe https://www.mycakeday.ch
//
// Never import into a client component.

const BASIS = () => (process.env.CAKEDAY_URL ?? "https://www.mycakeday.ch").replace(/\/$/, "");
const SECRET = () => process.env.CAKEDAY_KLAR_SECRET ?? "";

export const cakedayReady = () => Boolean(SECRET());
export const cakedayUrl = () => BASIS();

export type CakedayOrdner = "offen" | "erledigt" | "alle";

export interface CakedayFaden {
  faden: string;
  betreff: string;
  vorschau: string;
  gegenstelle: string;
  gegenstelleName: string | null;
  /** Geputzter Anzeigename der Gegenstelle, von Cakeday geliefert. */
  anzeige: string;
  postfach: string;
  anzahl: number;
  ungelesen: number;
  erledigt: boolean;
  hatAnhaenge: boolean;
  letzteAm: string;
  letzteRichtung: "ein" | "aus";
}

export interface CakedayAnhang {
  id: string;
  name: string;
  groesse: number;
}

export interface CakedayNachricht {
  id: string;
  richtung: "ein" | "aus";
  von: string;
  name: string;
  an: string[];
  cc: string[];
  betreff: string;
  vorschau: string;
  gesendetAm: string;
  gelesenAm: string | null;
  fehler: string | null;
  resendId: string | null;
  anhaenge: CakedayAnhang[];
  /** Gesaeubertes HTML, oder null bei Klartext. */
  html: string | null;
  bilderBlockiert: number;
  text: string;
  zitatHtml: string | null;
  zitatText: string | null;
}

export interface CakedayListe {
  faeden: CakedayFaden[];
  ungelesen: number;
  absender: string;
  domain: string;
  sendenBereit: boolean;
  empfangBereit: boolean;
}

export interface CakedayErgebnis {
  ok: boolean;
  meldung: string;
}

interface Antwort<T> {
  ok: boolean;
  status: number;
  daten: T | null;
  meldung: string;
}

async function api<T>(
  pfad: string,
  init: RequestInit & { revalidateSeconds?: number } = {},
): Promise<Antwort<T>> {
  if (!cakedayReady()) return { ok: false, status: 0, daten: null, meldung: "CAKEDAY_KLAR_SECRET fehlt." };
  const { revalidateSeconds, ...rest } = init;
  try {
    const res = await fetch(`${BASIS()}${pfad}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${SECRET()}`,
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
      // Nur die Ungelesen-Zahl darf in Nexts Daten-Cache; alles andere ist
      // Post, und Post, die eine Minute alt ist, ist die falsche Post.
      ...(typeof revalidateSeconds === "number"
        ? { next: { revalidate: revalidateSeconds } }
        : { cache: "no-store" as const }),
    });
    const daten = (await res.json().catch(() => null)) as (T & { meldung?: string }) | null;
    return {
      ok: res.ok,
      status: res.status,
      daten: res.ok ? daten : null,
      meldung: daten?.meldung ?? (res.ok ? "" : `mycakeday.ch antwortet ${res.status}`),
    };
  } catch (e) {
    return { ok: false, status: 0, daten: null, meldung: `mycakeday.ch nicht erreichbar (${String(e)})` };
  }
}

export async function cakedayFaeden(opts: {
  ordner?: CakedayOrdner;
  suche?: string;
}): Promise<Antwort<CakedayListe>> {
  const q = new URLSearchParams();
  if (opts.ordner && opts.ordner !== "offen") q.set("ordner", opts.ordner);
  if (opts.suche) q.set("suche", opts.suche.slice(0, 120));
  const qs = q.toString();
  return api<CakedayListe>(`/api/klar/postfach${qs ? `?${qs}` : ""}`);
}

export async function cakedayFaden(
  faden: string,
  gelesen: boolean,
): Promise<Antwort<{ faden: CakedayFaden | null; nachrichten: CakedayNachricht[] }>> {
  const q = new URLSearchParams({ faden });
  if (gelesen) q.set("gelesen", "1");
  return api(`/api/klar/postfach/faden?${q}`);
}

export async function cakedayAktion(body: {
  aktion: "antwort" | "neu" | "gelesen" | "erledigt" | "offen";
  faden?: string;
  text?: string;
  an?: string;
  betreff?: string;
}): Promise<CakedayErgebnis> {
  const r = await api<CakedayErgebnis>(`/api/klar/postfach/aktion`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (r.ok && r.daten) return r.daten;
  return { ok: false, meldung: r.meldung || "Das hat nicht geklappt." };
}

/** Frische Download-Adresse eines Anhangs, oder null. */
export async function cakedayAnhang(mail: string, id: string): Promise<string | null> {
  const q = new URLSearchParams({ mail, id });
  const r = await api<{ url: string }>(`/api/klar/postfach/anhang?${q}`);
  return r.ok && r.daten?.url ? r.daten.url : null;
}

/**
 * Ein einmaliger Anmeldelink ins Cakeday-Dashboard, fuer den Knopf „Oeffnen".
 * Nur eine Adresse auf CAKEDAY_URL wird zurueckgegeben — alles andere waere
 * eine Umleitung, die ein fremder Server bestimmt haette.
 */
export async function cakedayHandoff(weiter: string): Promise<{ ok: true; url: string } | { ok: false; meldung: string }> {
  const r = await api<{ url: string }>(`/api/klar/handoff`, {
    method: "POST",
    body: JSON.stringify({ weiter }),
  });
  const url = r.daten?.url ?? "";
  if (!r.ok || !url) return { ok: false, meldung: r.meldung || "Kein Anmeldelink bekommen." };
  if (!url.startsWith(`${BASIS()}/`)) return { ok: false, meldung: "Der Anmeldelink zeigt nicht auf mycakeday.ch." };
  return { ok: true, url };
}

/**
 * Nur die Zahl neben dem Menuepunkt, auf jeder Admin-Seite. Eine Minute
 * gecacht, wie die Collab-Zahl: eine Mail, die im Zaehler eine Minute spaeter
 * auftaucht, ist keinen Roundtrip nach mycakeday.ch pro Navigation wert.
 * Ohne Geheimnis oder bei Fehler still null — die Schiene soll wegen
 * mycakeday.ch nie haengen.
 */
export async function countCakedayUnread(): Promise<number> {
  if (!cakedayReady()) return 0;
  const r = await api<{ ungelesen: number }>(`/api/klar/postfach?nur=zahl`, { revalidateSeconds: 60 });
  return r.ok && typeof r.daten?.ungelesen === "number" ? r.daten.ungelesen : 0;
}
