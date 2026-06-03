// SERVER ONLY. Übersetzungs-Helper für die Outreach-Reply-Inbox.
// Affiliate-Antworten kommen in DE/EN/ES/IT/FR rein, Alain liest sie auf
// Deutsch. Ein Klick auf "Übersetzen" im Admin ruft /admin/outreach/translate,
// das hier landet.
//
// KEYLESS by default: Provider-Kette, alle ohne Account/Key nutzbar.
//   1. DeepL  — nur wenn DEEPL_API_KEY gesetzt ist (beste Qualität, opt-in).
//   2. Google — inoffizieller translate_a-Endpoint, auto-Spracherkennung,
//               keyless. Primärer Default. Für internes Low-Volume-Tooling
//               (ein paar Influencer-Replies) völlig ausreichend.
//   3. MyMemory — keyless Fallback, braucht die Quellsprache (sourceLang-Hint
//               aus dem UI), per-Request auf 500 Zeichen gedeckelt.
// Schlägt einer fehl, wird der nächste probiert. translateText wirft nie.

const DEEPL_API_KEY = process.env.DEEPL_API_KEY ?? "";
const DEEPL_URL = "https://api-free.deepl.com/v2/translate";

export function isTranslateConfigured(): boolean {
  // Keyless-Fallbacks (Google/MyMemory) sind immer da, also immer verfügbar.
  return true;
}

export interface TranslateResult {
  ok: boolean;
  text?: string;
  source?: string; // erkannte/angenommene Quellsprache, z.B. "EN"
  provider?: string; // "deepl" | "google" | "mymemory"
  error?: string;
}

/**
 * Übersetzt einen Text nach targetLang (Default Deutsch). Optionaler
 * sourceLang-Hint wird nur vom MyMemory-Fallback gebraucht (Google erkennt
 * die Sprache selbst). Gibt bei jedem Fehler ok=false + error zurück.
 */
export async function translateText(
  text: string,
  targetLang = "DE",
  sourceLang?: string,
): Promise<TranslateResult> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: "empty text" };
  const payload = clean.slice(0, 30000);
  const target = (targetLang || "DE").toUpperCase().slice(0, 5);
  const errors: string[] = [];

  if (DEEPL_API_KEY) {
    const r = await tryDeepL(payload, target);
    if (r.ok) return r;
    if (r.error) errors.push(r.error);
  }

  const g = await tryGoogle(payload, target);
  if (g.ok) return g;
  if (g.error) errors.push(g.error);

  const m = await tryMyMemory(payload, target, sourceLang);
  if (m.ok) return m;
  if (m.error) errors.push(m.error);

  return { ok: false, error: errors.join(" | ") || "keine Übersetzung" };
}

async function tryDeepL(payload: string, target: string): Promise<TranslateResult> {
  try {
    const res = await fetch(DEEPL_URL, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [payload], target_lang: target }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      const hint =
        res.status === 456
          ? " (Free-Kontingent aufgebraucht)"
          : res.status === 403
            ? " (Key ungültig)"
            : "";
      return { ok: false, error: `deepl ${res.status}${hint}: ${t.slice(0, 120)}` };
    }
    const data = (await res.json()) as {
      translations?: Array<{ text: string; detected_source_language: string }>;
    };
    const first = data.translations?.[0];
    if (!first) return { ok: false, error: "deepl: keine Übersetzung" };
    return { ok: true, text: first.text, source: first.detected_source_language, provider: "deepl" };
  } catch (e) {
    return { ok: false, error: `deepl: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// Inoffizieller Google-Endpoint (gtx-Client). Liefert ein verschachteltes
// Array: data[0] = Liste von [übersetzterChunk, originalChunk, ...], data[2]
// = erkannte Quellsprache. Lange Texte werden serverseitig in Chunks zerlegt,
// die wir wieder zusammenfügen.
async function tryGoogle(payload: string, target: string): Promise<TranslateResult> {
  const tl = target.toLowerCase().slice(0, 2);
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
    encodeURIComponent(tl) +
    "&dt=t&q=" +
    encodeURIComponent(payload);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return { ok: false, error: `google ${res.status}` };
    const data = (await res.json()) as unknown;
    const arr = data as [Array<[string]>?, unknown?, string?];
    const chunks = Array.isArray(arr?.[0]) ? (arr[0] as Array<[string]>) : [];
    const out = chunks.map((c) => (Array.isArray(c) ? c[0] || "" : "")).join("");
    if (!out.trim()) return { ok: false, error: "google: leere Antwort" };
    const src = typeof arr?.[2] === "string" ? (arr[2] as string).toUpperCase() : undefined;
    return { ok: true, text: out, source: src, provider: "google" };
  } catch (e) {
    return { ok: false, error: `google: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// MyMemory: keyless, braucht aber eine Quellsprache. Wir nehmen den UI-Hint
// (Sprache des Targets) oder 'en' als Default. Anonyme Requests sind auf
// ~500 Zeichen/Query begrenzt, daher hart deckeln (nur Last-Resort-Fallback).
async function tryMyMemory(
  payload: string,
  target: string,
  sourceLang?: string,
): Promise<TranslateResult> {
  const tl = target.toLowerCase().slice(0, 2);
  const sl = (sourceLang || "en").toLowerCase().slice(0, 2);
  if (sl === tl) return { ok: false, error: "mymemory: Quelle==Ziel" };
  const q = payload.slice(0, 500);
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(q) +
    "&langpair=" +
    encodeURIComponent(sl) +
    "|" +
    encodeURIComponent(tl);
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `mymemory ${res.status}` };
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number | string;
    };
    const out = data.responseData?.translatedText;
    if (!out) return { ok: false, error: "mymemory: leere Antwort" };
    return { ok: true, text: out, source: sl.toUpperCase(), provider: "mymemory" };
  } catch (e) {
    return { ok: false, error: `mymemory: ${e instanceof Error ? e.message : String(e)}` };
  }
}
