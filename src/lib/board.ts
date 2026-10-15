// SERVER ONLY. Das Board der Klar-Apps ("what i want next"): Ideen, auf die
// Nutzer stimmen, Alains Kommentare dazu und die Wuensche, die Nutzer privat
// schicken. Gepflegt unter Feedback > Board.
//
// Das Board liegt in der Datenbank der App, nicht im Hub: Klar Control liest
// und schreibt dort mit dem Service-Key aus KLAR_ADMIN_APPS, wie bei den
// App-Zahlen. Jede angeschlossene App erfuellt denselben Vertrag
// (Spec: AI-Brain Projects/Klar/specs/board/spec.md):
//   feature_ideas (title, detail, status, weight, translations)
//   feature_votes, feature_idea_comments (body, translations)
//   feature_wishes (body, body_de, promoted_idea_id, read_at)
//   RPCs promote_wish, mark_wish_read
// `title` und `detail` stehen in der Quellsprache der App, weil die App ohne
// Uebersetzung genau diese Spalten zeigt. `translations` traegt jede Sprache,
// die Quellsprache eingeschlossen. Eine App anschliessen heisst: Vertrag in
// ihrer Datenbank anlegen und eine Zeile in BOARD_APPS.
//
// Meldungen (Basalt 2.6.0, Events): Nutzer melden einen Spitznamen aus der
// Liste eines Events. Die App-Datenbank liefert sie ueber
// `event_report_list()` und erledigt sie ueber `handle_event_report()`, beide
// nur fuer den Service-Key. Sperren ersetzt den Spitznamen im Event durch einen
// neutralen, die Teilnahme bleibt. Eine App ohne Events hat keine Meldungen.

import { getApps, type AdminApp } from "./adminApps";
import { BoardError, translateItems, type Translations } from "./boardTranslate";

export { BoardError };

export interface BoardApp {
  /** In der Adresse: /admin/feedback/board?app=<slug>. */
  slug: string;
  name: string;
  /** Schluessel in KLAR_ADMIN_APPS, dort liegt der Service-Key. */
  backendSlug: string;
  /** Sprache von `title` und `detail`, also das, was die App ohne Uebersetzung zeigt. */
  sourceLang: string;
  /** Alle Sprachen der App, die Quellsprache eingeschlossen. */
  langs: string[];
  /** Ein Satz fuer Claude, wie die App schreibt. */
  voice: string;
}

export const BOARD_APPS: BoardApp[] = [
  {
    slug: "basalt",
    name: "Basalt",
    backendSlug: "wavelength",
    sourceLang: "en",
    // Wie LANGS in Basalt (src/i18n/lang.ts).
    langs: ["en", "de", "fr", "es", "it", "pt", "ja", "ko", "zh-Hant", "nl", "sv", "pl", "tr", "id", "vi", "ru", "uk", "th"],
    voice: "Write the way the app does: all lowercase wherever the script has letter case, short and calm, no exclamation marks.",
  },
];

export function findBoardApp(slug: string | null | undefined): BoardApp | null {
  return BOARD_APPS.find((a) => a.slug === slug) ?? null;
}

export const IDEA_STATUSES = ["open", "planned", "building", "shipped"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/** Wie Klar Control den Stand nennt (die App hat ihre eigenen Texte). */
export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  open: "offen",
  planned: "geplant",
  building: "im Bau",
  shipped: "fertig",
};

export interface Idea {
  id: string;
  title: string;
  detail: string | null;
  status: IdeaStatus;
  weight: number;
  votes: number;
  createdAt: string;
  translations: Translations;
}

export interface IdeaComment {
  id: string;
  body: string;
  translations: Translations;
  createdAt: string;
}

export interface Wish {
  id: string;
  body: string;
  /** Lesefassung auf Deutsch, null solange nicht uebersetzt. */
  bodyDe: string | null;
  createdAt: string;
  promotedIdeaId: string | null;
  readAt: string | null;
}

/** Ein gemeldeter Eintrag in einem Event, alle Meldungen dazu zusammengefasst. */
export interface EventReport {
  eventId: string;
  /** Das gemeldete Konto, fuer Sperren und Erledigen. */
  userId: string;
  nickname: string;
  /** ISO-Region der Flagge, null ohne Flagge. */
  flag: string | null;
  blocked: boolean;
  /** Wie viele Leute den Eintrag gemeldet haben. */
  reports: number;
  /** Davon noch nicht erledigt. */
  open: number;
  firstAt: string;
  lastAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Kennung eines Events, wie die Tabelle `events` sie erlaubt. */
const EVENT_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TITLE_MAX = 120;
const DETAIL_MAX = 600;
const COMMENT_MAX = 2000;
/** So viele Wuensche uebersetzt ein Aufruf an Claude. */
const WISH_BATCH = 20;

function backend(app: BoardApp): AdminApp {
  const conn = getApps().find((a) => a.slug === app.backendSlug);
  if (!conn) throw new BoardError(`${app.name} fehlt in KLAR_ADMIN_APPS.`);
  return conn;
}

async function db(app: BoardApp, path: string, init: RequestInit = {}): Promise<Response> {
  const conn = backend(app);
  try {
    return await fetch(`${conn.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: conn.serviceKey,
        Authorization: `Bearer ${conn.serviceKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new BoardError(`Datenbank von ${app.name} nicht erreichbar.`);
  }
}

/** Eine Schreibanfrage, die genau eine Zeile treffen muss. */
async function writeOne(app: BoardApp, path: string, init: RequestInit, missing: string): Promise<Record<string, unknown>> {
  const res = await db(app, path, { ...init, headers: { Prefer: "return=representation" } });
  if (!res.ok) throw new BoardError(await dbMessage(res));
  const rows = (await res.json()) as Record<string, unknown>[];
  if (!rows.length) throw new BoardError(missing);
  return rows[0];
}

/** Die Meldung aus einer Postgres-Ausnahme (promote_wish sagt, was nicht geht), sonst der Status. */
async function dbMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ? `Datenbank: ${body.message}` : `Datenbank antwortet mit ${res.status}.`;
}

function checkId(id: string, what: string): string {
  if (!UUID_RE.test(id)) throw new BoardError(`${what} nicht gefunden.`);
  return id;
}

function checkText(value: string, label: string, min: number, max: number): string {
  const v = value.trim();
  if (v.length < min) throw new BoardError(min > 1 ? `${label} braucht mindestens ${min} Zeichen.` : `${label} fehlt.`);
  if (v.length > max) throw new BoardError(`${label} ist länger als ${max} Zeichen.`);
  return v;
}

// --- Lesen -----------------------------------------------------------------

/** Wie die App das Board sortiert (Basalt: src/lib/wishes.ts): fertige unten, dann Gewicht, Stimmen, Titel. */
export function sortIdeas(ideas: Idea[]): Idea[] {
  const rank = (i: Idea) => (i.status === "shipped" ? 1 : 0);
  return [...ideas].sort(
    (a, b) => rank(a) - rank(b) || b.weight - a.weight || b.votes - a.votes || a.title.localeCompare(b.title),
  );
}

export async function fetchIdeas(app: BoardApp): Promise<Idea[]> {
  const res = await db(app, "feature_ideas?select=id,title,detail,status,weight,created_at,translations,feature_votes(count)");
  if (!res.ok) throw new BoardError(await dbMessage(res));
  const rows = (await res.json()) as Array<{
    id: string;
    title: string;
    detail: string | null;
    status: IdeaStatus;
    weight: number;
    created_at: string;
    translations: Translations | null;
    feature_votes: Array<{ count: number }> | null;
  }>;
  return sortIdeas(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail,
      status: r.status,
      weight: r.weight,
      votes: Number(r.feature_votes?.[0]?.count ?? 0),
      createdAt: r.created_at,
      translations: r.translations ?? {},
    })),
  );
}

export async function fetchComments(app: BoardApp, ideaId: string): Promise<IdeaComment[]> {
  const res = await db(
    app,
    `feature_idea_comments?select=id,body,translations,created_at&idea_id=eq.${checkId(ideaId, "Idee")}&order=created_at.asc`,
  );
  if (!res.ok) throw new BoardError(await dbMessage(res));
  const rows = (await res.json()) as Array<{ id: string; body: string; translations: Translations | null; created_at: string }>;
  return rows.map((r) => ({ id: r.id, body: r.body, translations: r.translations ?? {}, createdAt: r.created_at }));
}

/**
 * Die Wuensche, neueste zuerst. Wer noch keine deutsche Fassung hat, wird hier
 * uebersetzt und gespeichert, danach nie wieder. Scheitert das, kommen die
 * Wuensche trotzdem, mit `warning`, und der naechste Aufruf versucht es neu.
 */
export async function fetchWishes(app: BoardApp): Promise<{ wishes: Wish[]; warning: string | null }> {
  const res = await db(app, "feature_wishes?select=id,body,body_de,created_at,promoted_idea_id,read_at&order=created_at.desc&limit=200");
  if (!res.ok) throw new BoardError(await dbMessage(res));
  const rows = (await res.json()) as Array<{
    id: string;
    body: string;
    body_de: string | null;
    created_at: string;
    promoted_idea_id: string | null;
    read_at: string | null;
  }>;
  const wishes: Wish[] = rows.map((r) => ({
    id: r.id,
    body: r.body,
    bodyDe: r.body_de,
    createdAt: r.created_at,
    promotedIdeaId: r.promoted_idea_id,
    readAt: r.read_at,
  }));

  let warning: string | null = null;
  const missing = wishes.filter((w) => !w.bodyDe);
  for (let i = 0; i < missing.length && !warning; i += WISH_BATCH) {
    const batch = missing.slice(i, i + WISH_BATCH);
    try {
      const t = await translateItems(Object.fromEntries(batch.map((w) => [w.id, { body: w.body }])), ["de"]);
      await Promise.all(
        batch.map(async (w) => {
          const de = t[w.id]?.de?.body;
          if (!de) return;
          w.bodyDe = de;
          await db(app, `feature_wishes?id=eq.${w.id}`, { method: "PATCH", body: JSON.stringify({ body_de: de }) });
        }),
      );
    } catch (e) {
      warning = e instanceof BoardError ? e.message : "Übersetzung der Wünsche gescheitert.";
    }
  }
  return { wishes, warning };
}

// --- Schreiben -------------------------------------------------------------

export interface IdeaText {
  title: string;
  detail: string;
}

/** Uebersetzt Titel und Beschreibung in alle Sprachen der App; die Quellsprache wird zu title/detail. */
async function translateIdea(app: BoardApp, input: IdeaText) {
  const title = checkText(input.title, "Der Titel", 3, TITLE_MAX);
  const detail = input.detail.trim() ? checkText(input.detail, "Die Beschreibung", 1, DETAIL_MAX) : "";
  const translations = (await translateItems({ idea: { title, detail } }, app.langs, app.voice)).idea;
  const source = translations[app.sourceLang];
  return { title: source.title, detail: source.detail ?? null, translations };
}

/** Legt eine Idee an, Stand offen, Gewicht 0. Gibt ihre id zurueck. */
export async function createIdea(app: BoardApp, input: IdeaText): Promise<string> {
  const row = await translateIdea(app, input);
  const saved = await writeOne(app, "feature_ideas", { method: "POST", body: JSON.stringify(row) }, "Idee nicht angelegt.");
  return String(saved.id);
}

export async function updateIdeaText(app: BoardApp, ideaId: string, input: IdeaText): Promise<void> {
  const id = checkId(ideaId, "Idee");
  const row = await translateIdea(app, input);
  await writeOne(app, `feature_ideas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(row) }, "Idee nicht gefunden.");
}

export async function setIdeaStatus(app: BoardApp, ideaId: string, status: string): Promise<void> {
  const id = checkId(ideaId, "Idee");
  if (!(IDEA_STATUSES as readonly string[]).includes(status)) throw new BoardError("Unbekannter Stand.");
  await writeOne(app, `feature_ideas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) }, "Idee nicht gefunden.");
}

export async function setIdeaWeight(app: BoardApp, ideaId: string, weight: string): Promise<void> {
  const id = checkId(ideaId, "Idee");
  const n = Number(weight.trim());
  if (!weight.trim() || !Number.isInteger(n) || Math.abs(n) > 999) throw new BoardError("Gewicht ist eine ganze Zahl von -999 bis 999.");
  await writeOne(app, `feature_ideas?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ weight: n }) }, "Idee nicht gefunden.");
}

/** Ein Kommentar von Alain, im Original und in allen Sprachen der App. */
export async function addComment(app: BoardApp, ideaId: string, text: string): Promise<void> {
  const id = checkId(ideaId, "Idee");
  const body = checkText(text, "Der Kommentar", 1, COMMENT_MAX);
  const translations = (await translateItems({ comment: { body } }, app.langs, app.voice)).comment;
  await writeOne(
    app,
    "feature_idea_comments",
    { method: "POST", body: JSON.stringify({ idea_id: id, body, translations }) },
    "Kommentar nicht gespeichert.",
  );
}

/** Stellt einen Wunsch als Idee aufs Board (RPC promote_wish), mit Uebersetzungen. Gibt die id der Idee zurueck. */
export async function promoteWish(app: BoardApp, wishId: string, input: IdeaText): Promise<string> {
  const id = checkId(wishId, "Wunsch");
  const row = await translateIdea(app, input);
  const res = await db(app, "rpc/promote_wish", {
    method: "POST",
    body: JSON.stringify({ p_wish_id: id, p_title: row.title, p_detail: row.detail }),
  });
  if (!res.ok) throw new BoardError(await dbMessage(res));
  const idea = (await res.json()) as { id: string };
  await writeOne(
    app,
    `feature_ideas?id=eq.${idea.id}`,
    { method: "PATCH", body: JSON.stringify({ translations: row.translations }) },
    "Idee steht auf dem Board, die Übersetzungen fehlen. Text einmal speichern.",
  );
  return idea.id;
}

export async function markWishRead(app: BoardApp, wishId: string): Promise<void> {
  const res = await db(app, "rpc/mark_wish_read", { method: "POST", body: JSON.stringify({ p_wish_id: checkId(wishId, "Wunsch") }) });
  if (!res.ok) throw new BoardError(await dbMessage(res));
}

// --- Meldungen ---------------------------------------------------------------

/** Die gemeldeten Eintraege, offene zuerst, dann die juengsten. */
export async function fetchReports(app: BoardApp): Promise<EventReport[]> {
  const res = await db(app, "rpc/event_report_list", { method: "POST", body: "{}" });
  if (!res.ok) throw new BoardError(await dbMessage(res));
  const rows = (await res.json()) as Array<{
    event_id: string;
    user_id: string;
    nickname: string;
    flag: string | null;
    blocked: boolean;
    reports: number;
    open: number;
    first_at: string;
    last_at: string;
  }>;
  return rows.map((r) => ({
    eventId: r.event_id,
    userId: r.user_id,
    nickname: r.nickname,
    flag: r.flag,
    blocked: r.blocked,
    reports: r.reports,
    open: r.open,
    firstAt: r.first_at,
    lastAt: r.last_at,
  }));
}

/**
 * Erledigt die offenen Meldungen eines Eintrags; mit `block` wird dabei sein
 * Spitzname im Event gesperrt. Gibt zurueck, wie viele Meldungen das schloss.
 */
export async function handleReport(app: BoardApp, eventId: string, userId: string, block: boolean): Promise<number> {
  if (eventId.length < 3 || eventId.length > 40 || !EVENT_ID_RE.test(eventId)) throw new BoardError("Event nicht gefunden.");
  const user = checkId(userId, "Eintrag");
  const res = await db(app, "rpc/handle_event_report", {
    method: "POST",
    body: JSON.stringify({ p_event: eventId, p_user: user, p_block: block }),
  });
  if (!res.ok) throw new BoardError(await dbMessage(res));
  return Number(await res.json());
}
