// SERVER ONLY. Uebersetzt die Texte des Boards (lib/board) in die Sprachen
// einer App, per Claude. Ein Aufruf pro Speichern: alle Felder, alle Sprachen,
// als JSON, dessen Form ein Schema festlegt, damit keine Sprache fehlen kann.
//
// Der Key kommt aus dem Klar-Vault (Eintrag "Anthropic-API-Key"), wie Resend im
// notifFlusher. Jeder Fehler wird zu einem BoardError mit einem Satz fuer die
// Seite; wer uebersetzt, schreibt danach nichts.

import Anthropic from "@anthropic-ai/sdk";
import { getForProxy } from "./vault";

const ANTHROPIC_SECRET_ID = "e271b182-e630-42fd-b20d-79d8134cc37f"; // vault: "Anthropic-API-Key"

/** Ein Fehler, dessen Text so auf der Seite stehen kann. */
export class BoardError extends Error {}

/** Felder je Sprache, z.B. `{ de: { title: "...", detail: "..." } }`. */
export type Translations = Record<string, Record<string, string>>;

const SYSTEM = `You translate short texts for the feature board inside a mobile app: idea titles and descriptions, comments from the developer, and wishes users sent.
Translate every field of every item into every requested language. Language codes are BCP 47; zh-Hant is Traditional Chinese.
Keep the meaning exactly. Do not add, explain or soften anything, and keep names of apps and features as they are.
If a field is already in a target language, return it unchanged for that language.`;

function objectSchema(props: Record<string, unknown>) {
  return { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
}

/**
 * Uebersetzt mehrere Eintraege in einem Aufruf. `items` traegt je Schluessel
 * einen Satz Felder; zurueck kommt je Schluessel jede Sprache mit denselben
 * Feldern. Leere Felder gehen nicht mit, ein Eintrag ohne Text kommt leer zurueck.
 */
export async function translateItems(
  items: Record<string, Record<string, string | null | undefined>>,
  langs: string[],
  voice = "",
): Promise<Record<string, Translations>> {
  const clean: Record<string, Record<string, string>> = {};
  for (const [key, fields] of Object.entries(items)) {
    const kept = Object.entries(fields).filter((e): e is [string, string] => !!e[1]?.trim());
    if (kept.length) clean[key] = Object.fromEntries(kept.map(([f, v]) => [f, v.trim()]));
  }
  const out: Record<string, Translations> = Object.fromEntries(Object.keys(items).map((k) => [k, {}]));
  if (!Object.keys(clean).length || !langs.length) return out;

  const secret = await getForProxy(ANTHROPIC_SECRET_ID);
  if (!secret) throw new BoardError("Anthropic-Key im Vault nicht nutzbar. Nichts gespeichert.");

  const schema = objectSchema(
    Object.fromEntries(
      Object.entries(clean).map(([key, fields]) => [
        key,
        objectSchema(
          Object.fromEntries(
            langs.map((l) => [l, objectSchema(Object.fromEntries(Object.keys(fields).map((f) => [f, { type: "string" }])))]),
          ),
        ),
      ]),
    ),
  );

  const client = new Anthropic({ apiKey: secret.key });
  let res: Anthropic.Beta.Messages.BetaMessage;
  try {
    res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Lehnt Claude ab, uebernimmt serverseitig ein passendes Modell.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: voice ? `${SYSTEM}\n${voice}` : SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: `Languages: ${langs.join(", ")}\n\n${JSON.stringify(clean)}` }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new BoardError("Claude ist gerade ausgelastet. Nichts gespeichert, gleich nochmal.");
    if (e instanceof Anthropic.APIConnectionError) throw new BoardError("Claude nicht erreichbar. Nichts gespeichert.");
    if (e instanceof Anthropic.APIError) throw new BoardError(`Claude antwortet mit ${e.status}. Nichts gespeichert.`);
    throw e;
  }
  if (res.stop_reason === "refusal") throw new BoardError("Claude hat die Übersetzung abgelehnt. Nichts gespeichert.");
  if (res.stop_reason === "max_tokens") throw new BoardError("Übersetzung zu lang. Nichts gespeichert.");

  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: Record<string, Translations>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BoardError("Übersetzung kam unlesbar zurück. Nichts gespeichert.");
  }
  for (const key of Object.keys(clean)) {
    if (!langs.every((l) => parsed?.[key]?.[l])) throw new BoardError("Übersetzung unvollständig. Nichts gespeichert.");
    out[key] = parsed[key];
  }
  return out;
}
