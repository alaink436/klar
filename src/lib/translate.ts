// SERVER ONLY. DeepL-Free Übersetzungs-Helper für die Outreach-Reply-Inbox.
// Affiliate-Antworten kommen in DE/EN/ES/IT/FR rein; Alain liest sie auf
// Deutsch. Ein Klick auf "Übersetzen" im Admin ruft /admin/outreach/translate,
// das hier landet.
//
// Free-Tier: 500k Zeichen/Monat, Endpoint api-free.deepl.com. Der Key liegt in
// DEEPL_API_KEY (Vercel env). Ohne Key ist isTranslateConfigured() false und
// das UI blendet den Übersetzen-Button aus, statt zu crashen.

const DEEPL_API_KEY = process.env.DEEPL_API_KEY ?? "";
const DEEPL_URL = "https://api-free.deepl.com/v2/translate";

export function isTranslateConfigured(): boolean {
  return Boolean(DEEPL_API_KEY);
}

export interface TranslateResult {
  ok: boolean;
  text?: string;
  source?: string; // erkannte Quellsprache, z.B. "EN"
  error?: string;
}

/**
 * Übersetzt einen Text via DeepL Free. Default-Ziel Deutsch. Gibt bei jedem
 * Fehler ok=false + error zurück, wirft nie — der Aufrufer (JSON-Route) kann
 * das 1:1 weiterreichen.
 */
export async function translateText(
  text: string,
  targetLang = "DE",
): Promise<TranslateResult> {
  if (!DEEPL_API_KEY) return { ok: false, error: "DEEPL_API_KEY not set" };
  const clean = text.trim();
  if (!clean) return { ok: false, error: "empty text" };
  // Eine einzelne Reply ist nie lang; trotzdem hart deckeln, damit ein
  // versehentlich riesiger Input nicht das Monats-Kontingent frisst.
  const payload = clean.slice(0, 30000);
  // DeepL erwartet Sprach-Codes in Grossbuchstaben (DE, EN, ES, IT, FR).
  const target = (targetLang || "DE").toUpperCase().slice(0, 5);
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
      // 456 = Kontingent aufgebraucht, 403 = Key falsch — beides klar melden.
      const hint =
        res.status === 456
          ? " (Free-Kontingent aufgebraucht)"
          : res.status === 403
            ? " (Key ungültig)"
            : "";
      return { ok: false, error: `deepl ${res.status}${hint}: ${t.slice(0, 160)}` };
    }
    const data = (await res.json()) as {
      translations?: Array<{ text: string; detected_source_language: string }>;
    };
    const first = data.translations?.[0];
    if (!first) return { ok: false, error: "deepl: keine Übersetzung erhalten" };
    return { ok: true, text: first.text, source: first.detected_source_language };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
