// SERVER ONLY. The Brain-Reader: reads the AI-Brain vault from GitHub, cached,
// with typed results. Chronik, the overview ("Woran ich gerade arbeite"), the
// AI-Brain page and the Ticket-Ansicht all read the vault through here.
//
// How it is built:
//   - A source delivers raw files. In production that is GitHub via brainVault
//     (token and path guard live there); the tests hand in sample files.
//   - One cached read per file, kept for about 60 s. Callers that need the same
//     file share one request, so STATUS.md is fetched once per page even when
//     two readers ask for it.
//   - Pure, exported parsers turn the markdown into typed results.
//
// Deliberately tolerant: the vault is prose written for humans, so anything
// that does not parse is skipped rather than thrown. A missing GitHub token or
// a renamed heading degrades to an empty list and the page hides the section;
// it never breaks the page. Tickets are the exception: a ticket that does not
// parse comes back as unreadable instead of vanishing from the list.

import { blobUrl, fetchNote, fetchPaths, type NoteResult, type PathsResult } from "@/lib/brainVault";

type Failed = Extract<NoteResult, { ok: false }>;

/** Where the reader gets raw files from: GitHub in production, sample files in the tests. */
export interface BrainSource {
  /** Markdown of one note, by vault path. */
  note(path: string): Promise<NoteResult>;
  /** Every file path in the vault. */
  paths(): Promise<PathsResult>;
}

const TTL_MS = 60_000;

// ── Active Now ─────────────────────────────────────────────────────────────
// The "Active Now" table of STATUS.md answers "what am I working on and how
// far did I get?" without a second place to maintain.

export interface BrainProject {
  name: string;
  /** "MM-DD" as written in the table. */
  touch: string;
  /** Days since that date, or null if it did not parse. */
  daysAgo: number | null;
  /** First sentence of the Phase column: where the project stands. */
  phase: string;
  /** The Next column, split into its individual open items. */
  next: string[];
  /** Items flagged 🔴 in the Next column: blocking, do these first. */
  blockers: string[];
}

/** Strip the markdown a table cell carries so it can render as plain text. */
function plain(cell: string): string {
  return cell
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1") // [[wiki links]]
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url)
    .replace(/\*\*|__|`/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * First sentence of the phase cell. The cells run for thousands of characters
 * (the whole session story), and the opening clause is the part that says
 * where the thing stands. Everything after it is history.
 */
function firstClause(text: string, max = 150): string {
  const t = plain(text);
  // Split on sentence end or the "·" and the em dash the status lines use as separators.
  const m = t.match(/^(.{20,}?)(?:\.\s|\s\u2014\s|\s·\s|;\s)/);
  const head = (m ? m[1] : t).trim();
  return head.length > max ? `${head.slice(0, max - 1).trimEnd()}…` : head;
}

function daysSince(mmdd: string, now: Date): number | null {
  const m = mmdd.match(/^(\d{2})-(\d{2})$/);
  if (!m) return null;
  // The table only carries MM-DD. Assume the current year, and if that lands
  // in the future (December row read in January) fall back a year.
  let d = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  if (d.getTime() - now.getTime() > 86_400_000) d = new Date(now.getFullYear() - 1, Number(m[1]) - 1, Number(m[2]));
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  return days < 0 ? 0 : days;
}

/** Split a markdown table row into its cells. */
function cells(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
}

/** Projects under the "Active Now" heading of STATUS.md, most recently touched first. */
export function parseActiveProjects(statusMd: string, now = new Date()): BrainProject[] {
  const lines = statusMd.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s.*Active Now/i.test(l));
  if (start === -1) return [];

  const projects: BrainProject[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break; // next section, done
    if (!line.trimStart().startsWith("|")) continue;
    const c = cells(line);
    if (c.length < 4) continue;
    const name = plain(c[0]);
    const touch = plain(c[1]);
    if (!name || /^projekt$/i.test(name) || /^-+$/.test(touch.replace(/[:\s]/g, ""))) continue; // header + separator

    const nextItems = plain(c[3])
      .split(/\s·\s/)
      .map((s) => s.trim())
      .filter(Boolean);
    projects.push({
      name,
      touch,
      daysAgo: daysSince(touch, now),
      phase: firstClause(c[2]),
      next: nextItems,
      blockers: nextItems.filter((s) => s.includes("🔴")),
    });
  }

  projects.sort((a, b) => (a.daysAgo ?? 999) - (b.daysAgo ?? 999));
  return projects;
}

// ── Learnings ──────────────────────────────────────────────────────────────
// Warum das hier steht: der Brain-Graph zählt DATEIEN. Alle Learnings landen
// per Anhängen in fünf Dateien (tech-stack, tooling, workflow, cost-discipline
// + INDEX), also bleiben es fünf Punkte im Graph, egal wie viel dazukommt. Das
// Wachstum, das am meisten passiert, ist ausgerechnet das unsichtbare.
// Diese Auswertung liest die Datums-Tabelle aus Learnings/INDEX.md und zählt
// EINTRÄGE statt Dateien.

export interface LearningEntry {
  date: string; // YYYY-MM-DD
  title: string;
  tags: string[];
}

export interface LearningStats {
  total: number;
  last7: number;
  last30: number;
  recent: LearningEntry[];
  /** Tag eines Eintrags, der am längsten zurückliegt, für "seit wann". */
  oldest: string | null;
  /** Einträge je Kalenderwoche (Montagsdatum), älteste zuerst, Lücken als 0. */
  byWeek: { week: string; count: number }[];
  /** Häufigste Tags mit Anteil am Bestand. */
  topTags: { tag: string; count: number; share: number }[];
}

export function parseLearnings(indexMd: string, recentCount = 5, now = Date.now()): LearningStats | null {
  const entries: LearningEntry[] = [];
  for (const line of indexMd.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("|")) continue;
    const c = cells(line);
    if (c.length < 2) continue;
    const date = plain(c[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue; // Kopf- und Trennzeilen raus
    // Titel = der erste **fett** gesetzte Teil, sonst der Anfang der Zelle.
    const raw = c[1];
    const bold = raw.match(/\*\*(.+?)\*\*/);
    entries.push({
      date,
      title: plain(bold ? bold[1] : raw).slice(0, 160),
      tags: (c[3] ? plain(c[3]).split(",").map((t) => t.replace(/`/g, "").trim()) : []).filter(Boolean),
    });
  }
  if (entries.length === 0) return null;

  entries.sort((a, b) => b.date.localeCompare(a.date));
  const dayMs = 86_400_000;
  const within = (days: number) =>
    entries.filter((e) => now - Date.parse(`${e.date}T12:00:00Z`) <= days * dayMs).length;

  // Wochenverlauf, nicht Monate. Gemessen am 2026-08-31 deckt der ganze Bestand
  // erst vier Monate ab, davon 265 von 398 im August: als Monatsbalken sind das
  // drei Striche neben einem Turm. Dieselben Daten je Woche ergeben 18 Punkte
  // mit sichtbarem Rhythmus. Luecken werden mit 0 gefuellt, sonst schoebe eine
  // stille Woche die Balken zusammen und zeigte einen Takt, den es nicht gab.
  const monday = (iso: string): string => {
    const d = new Date(`${iso}T12:00:00Z`);
    const shift = (d.getUTCDay() + 6) % 7; // Montag = 0
    d.setUTCDate(d.getUTCDate() - shift);
    return d.toISOString().slice(0, 10);
  };
  const counts = new Map<string, number>();
  for (const e of entries) {
    const w = monday(e.date);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const byWeek: { week: string; count: number }[] = [];
  const firstWeek = entries[entries.length - 1] ? monday(entries[entries.length - 1].date) : null;
  const lastWeek = entries[0] ? monday(entries[0].date) : null;
  if (firstWeek && lastWeek) {
    const cur = new Date(`${firstWeek}T12:00:00Z`);
    const end = new Date(`${lastWeek}T12:00:00Z`);
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      byWeek.push({ week: key, count: counts.get(key) ?? 0 });
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
  }

  // Tags, haeufigste zuerst. Der Anteil steht dabei, weil ein Tag ueber ~15 %
  // nichts mehr eingrenzt. Das ist beim Suchen wichtiger als die nackte Zahl.
  const tagCounts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.tags) {
      const key = t.toLowerCase();
      if (!key) continue;
      tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count, share: count / entries.length }));

  return {
    total: entries.length,
    last7: within(7),
    last30: within(30),
    recent: entries.slice(0, recentCount),
    oldest: entries[entries.length - 1]?.date ?? null,
    byWeek: byWeek.slice(-16),
    topTags,
  };
}

// ── Chronik ────────────────────────────────────────────────────────────────
// "Was habe ich in den Sessions gemacht" + "was habe ich mir vorgenommen".
// Beides steht schon im Vault: die Sessions als Überschriften in den
// PROGRESS.md-Dateien, die Ziele als Next-Spalte in STATUS.md. Hier wird nur
// gelesen und zusammengeführt. Eine zweite Pflege wäre eine zweite Wahrheit.

export interface SessionEntry {
  /** "YYYY-MM-DD"; Einträge ohne erkennbares Datum fallen raus. */
  date: string;
  project: string;
  title: string;
}

/** Projektname aus STATUS.md → Ordnername im Vault (aus der Registry). */
export function parseRegistryFolders(registryMd: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of registryMd.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("|")) continue;
    const c = cells(line);
    if (c.length < 2) continue;
    const name = plain(c[0]);
    const link = c[1].match(/\[\[([^\]|]+)/);
    if (name && link) map.set(name, link[1].trim());
  }
  return map;
}

/**
 * Überschriften einer PROGRESS.md als Session-Einträge. Erkannt werden beide
 * Formen, die im Vault vorkommen:
 *   ## Last Updated (2026-08-11, S84 To-do-Liste …)
 *   ### S79 Collabs-Tab (verdichtet, 07-11/07-12, prod)
 * Ein Datum ohne Jahr ("07-11") bekommt das Jahr aus dem Kontext.
 */
export function parseSessions(progressMd: string, project: string, fallbackYear: number): SessionEntry[] {
  const out: SessionEntry[] = [];
  for (const line of progressMd.split(/\r?\n/)) {
    const m = line.match(/^#{2,3}\s+(.*)$/);
    if (!m) continue;
    const head = plain(m[1]);
    if (!head) continue;
    const full = head.match(/(\d{4})-(\d{2})-(\d{2})/);
    const short = full ? null : head.match(/\b(\d{2})-(\d{2})\b/);
    if (!full && !short) continue;
    const date = full
      ? `${full[1]}-${full[2]}-${full[3]}`
      : `${fallbackYear}-${short![1]}-${short![2]}`;
    // Titel = Überschrift ohne Datum und ohne die Klammer-Reste, die dabei
    // entstehen. Die beiden Formen im Vault sehen so aus:
    //   "Last Updated (2026-08-11, S84 To-do-Liste)" → "S84 To-do-Liste"
    //   "S83 Menü anpassbar (2026-08-11)"            → "S83 Menü anpassbar"
    // Erst das Datum raus, dann eine dadurch führende offene bzw. schliessende
    // Klammer. Vorher war der Titel oft komplett leer und fiel auf die rohe
    // Überschrift zurück.
    const title = head
      .replace(/^Last Updated\s*/i, "")
      .replace(/\d{4}-\d{2}-\d{2}/g, "")
      // Wortgrenzen: sonst schneidet das Muster mitten in laengeren Zahlen mit.
      .replace(/\b\d{2}-\d{2}\b/g, "")
      .replace(/\(\s*\)/g, "")
      .replace(/^\s*\(\s*[,;\u2014–-]*\s*/, "")
      .replace(/\s*\)\s*$/, "")
      .replace(/^[\s,;\u2014–-]+|[\s,;\u2014–-]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    out.push({ date, project, title: (title || head).slice(0, 140) });
  }
  return out;
}

// ── Zustand: was die Generatoren melden ──────────────────────────────────
//
// Seit dem Umbau vom 2026-08-20 werden STATUS.md, die Registry-Tabelle,
// Learnings/INDEX.md, der Skill-Bestand und die Supabase-Tabelle erzeugt. Jeder
// Generator schreibt seine offenen Punkte unter eine Überschrift in die Datei,
// die er baut. Bisher sah die nur, wer ihn selbst laufen liess.
//
// Hier werden genau diese Abschnitte eingesammelt. Kein zweiter Datenweg, keine
// neue Tabelle: die Wahrheit steht schon in den Dateien, sie war nur nicht
// sichtbar. Findet sich der Abschnitt nicht, gilt die Datei als sauber, denn die
// Generatoren schreiben ihn nur, wenn es etwas zu melden gibt.

export interface VaultCheck {
  /** Anzeigename der erzeugten Datei. */
  quelle: string;
  /** Vault-Pfad, für den Sprung in den Viewer. */
  pfad: string;
  /** Das "Stand:"-Datum, das der Generator hineinschreibt, falls vorhanden. */
  stand: string | null;
  /** Die gemeldeten Punkte, Markdown entfernt. */
  meldungen: string[];
}

const CHECK_QUELLEN: Array<{ quelle: string; pfad: string }> = [
  { quelle: "Dashboard", pfad: "STATUS.md" },
  { quelle: "Learnings", pfad: "Learnings/INDEX.md" },
  { quelle: "Skills", pfad: "Skills/00-Skill-Registry.md" },
  { quelle: "Supabase", pfad: "Infrastructure/supabase-projekte.md" },
];

/** "Stand:"-Datum und die Aufzählung unter der Meldungs-Überschrift, bis zur nächsten Überschrift. */
export function parseGeneratorReport(text: string): Pick<VaultCheck, "stand" | "meldungen"> {
  const stand = text.match(/^>\s*Stand:\s*(\d{4}-\d{2}-\d{2})/m);
  const meldungen: string[] = [];
  const start = text.search(/^#{2,3}\s*⚠️\s*Vom Generator gemeldet|^\*\*Vom Generator gemeldet:\*\*/m);
  if (start !== -1) {
    const rest = text.slice(start).split("\n").slice(1);
    for (const zeile of rest) {
      if (/^#{1,3}\s/.test(zeile)) break;
      const m = zeile.match(/^-\s+(.*)$/);
      if (!m) continue;
      // Backticks und Fettdruck raus, der Kasten rendert reinen Text.
      meldungen.push(m[1].replace(/`/g, "").replace(/\*\*/g, "").trim());
    }
  }
  return { stand: stand ? stand[1] : null, meldungen: meldungen.filter(Boolean) };
}

// ── Tickets ────────────────────────────────────────────────────────────────
// Tickets of every spec in the vault, for the Ticket-Ansicht. A ticket is a
// file Projects/<Ordner>/specs/<feature>/issues/<NN>-<slug>.md; its head is
// written by the to-tickets skill and the ABLAGE of the engineering skills:
//
//   # 09: Titel
//
//   Status: in Arbeit
//   Session: <Titel der Session>, seit 2026-10-07 21:12
//   Blockiert von: 01 (Titel), 02 (Titel)
//   Aufwand: 3 bis 4 h
//
// then the acceptance boxes "- [ ]" / "- [x]" and, optionally, a list under
// "## Kommentare" whose last item is the latest comment.

const TICKET_PATH = /^Projects\/([^/]+)\/specs\/([^/]+)\/issues\/(\d+)-[^/]+\.md$/;
const STATUSES = ["bereit", "in Arbeit", "erledigt", "verworfen"] as const;
export type TicketStatus = (typeof STATUSES)[number];

interface TicketFile {
  /** Vault path. */
  path: string;
  /** Folder under Projects/. */
  project: string;
  /** Folder under specs/. */
  feature: string;
  /** "09", from the file name. */
  number: string;
  /** The file on GitHub. */
  url: string;
}

export interface Ticket extends TicketFile {
  readable: true;
  title: string;
  status: TicketStatus;
  /** Numbers of the tickets in the same feature this one waits for. */
  blockers: string[];
  /** Acceptance boxes above "## Kommentare". */
  progress: { done: number; total: number };
  /** From the "Session:" line; null when the ticket has none. */
  sessionTitle: string | null;
  /** "YYYY-MM-DD HH:MM" (Zurich time) from the "Session:" line. */
  takenAt: string | null;
  /** Last item under "## Kommentare", nested lines included. */
  lastComment: string | null;
  /** Frontier: status "bereit" and every blocker "erledigt". */
  free: boolean;
}

export interface UnreadableTicket extends TicketFile {
  readable: false;
  /** What did not parse, for display. */
  reason: string;
}

export type TicketEntry = Ticket | UnreadableTicket;
export type TicketsResult = { ok: true; tickets: TicketEntry[] } | Failed;

export function isTicketPath(path: string): boolean {
  return TICKET_PATH.test(path);
}

function ticketFile(path: string): TicketFile {
  const m = path.match(TICKET_PATH);
  return { path, project: m?.[1] ?? "", feature: m?.[2] ?? "", number: m?.[3] ?? "", url: blobUrl(path) };
}

export function unreadableTicket(path: string, reason: string): UnreadableTicket {
  return { ...ticketFile(path), readable: false, reason };
}

/** "keine (kann sofort starten)" → [], "01 (Titel), 02 (Titel)" → ["01", "02"], anything else → null. */
function parseBlockers(raw: string): string[] | null {
  if (/^keine\b/i.test(raw)) return [];
  const out: string[] = [];
  let rest = raw.trim();
  while (rest) {
    const num = rest.match(/^(\d+)\s*/);
    if (!num) return null;
    out.push(num[1]);
    rest = rest.slice(num[0].length);
    // The title may hold commas and brackets of its own, so match the brackets.
    if (rest.startsWith("(")) {
      let depth = 0;
      let end = -1;
      for (let i = 0; i < rest.length && end === -1; i++) {
        if (rest[i] === "(") depth++;
        else if (rest[i] === ")" && --depth === 0) end = i;
      }
      if (end === -1) return null;
      rest = rest.slice(end + 1).trimStart();
    }
    if (rest.startsWith(",")) rest = rest.slice(1).trimStart();
    else if (rest) return null;
  }
  return out.length ? out : null;
}

/** The last top-level item of a markdown list, with its indented continuation lines. */
function lastListItem(lines: string[]): string | null {
  const end = lines.findIndex((l) => /^#{1,2}\s/.test(l));
  const section = end === -1 ? lines : lines.slice(0, end);
  let start = -1;
  section.forEach((l, i) => {
    if (/^[-*]\s/.test(l)) start = i;
  });
  if (start === -1) return null;
  const item = section.slice(start);
  while (!item[item.length - 1].trim()) item.pop();
  const more = item.slice(1);
  const indent = Math.min(...more.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  return [item[0].replace(/^[-*]\s+/, ""), ...more.map((l) => (Number.isFinite(indent) ? l.slice(indent) : l))].join("\n");
}

function parseTicket(path: string, text: string): Omit<Ticket, "free"> | UnreadableTicket {
  if (!TICKET_PATH.test(path)) return unreadableTicket(path, "Pfad ist kein Ticket");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let i = lines.findIndex((l) => l.trim() !== "");
  const head = i === -1 ? null : lines[i].match(/^#\s+\d+:\s*(.+?)\s*$/);
  if (!head) return unreadableTicket(path, "Titelzeile fehlt (# NN: Titel)");

  // The "Key: value" lines right under the title, up to the first blank line after them.
  const fields = new Map<string, string>();
  for (i++; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (fields.size) break;
      continue;
    }
    const f = line.match(/^([^\s:#*>|-][^:]*):\s*(.*)$/);
    if (!f) break;
    fields.set(f[1].trim().toLowerCase(), f[2].trim());
  }

  const statusRaw = fields.get("status");
  const status = STATUSES.find((s) => s.toLowerCase() === statusRaw?.toLowerCase());
  if (!status) return unreadableTicket(path, statusRaw ? `Status unbekannt: ${statusRaw}` : "Status fehlt");

  const blockersRaw = fields.get("blockiert von");
  if (blockersRaw === undefined) return unreadableTicket(path, "Blockiert von fehlt");
  const blockers = parseBlockers(blockersRaw);
  if (!blockers) return unreadableTicket(path, `Blockiert von unlesbar: ${blockersRaw}`);

  // "Session: <Titel>, seit <JJJJ-MM-TT HH:MM>". The title may hold commas, so
  // cut at the last ", seit ".
  let sessionTitle: string | null = null;
  let takenAt: string | null = null;
  const session = fields.get("session");
  if (session !== undefined) {
    const cut = session.lastIndexOf(", seit ");
    const title = cut === -1 ? "" : session.slice(0, cut).trim();
    const since = cut === -1 ? "" : session.slice(cut + ", seit ".length).trim();
    if (!title || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(since)) {
      return unreadableTicket(path, `Session-Zeile unlesbar: ${session}`);
    }
    sessionTitle = title;
    takenAt = since;
  }

  const body = lines.slice(i);
  const k = body.findIndex((l) => /^##\s+Kommentare\s*$/.test(l));
  let done = 0;
  let total = 0;
  for (const line of k === -1 ? body : body.slice(0, k)) {
    const box = line.match(/^\s*[-*]\s+\[([ xX])\]/);
    if (!box) continue;
    total++;
    if (box[1] !== " ") done++;
  }

  return {
    ...ticketFile(path),
    readable: true,
    title: head[1],
    status,
    blockers,
    progress: { done, total },
    sessionTitle,
    takenAt,
    lastComment: k === -1 ? null : lastListItem(body.slice(k + 1)),
  };
}

/**
 * Parses ticket files and works out the frontier. Blockers count within the
 * same feature folder; a blocker that is missing or unreadable is not
 * "erledigt", so the ticket waiting for it is not free.
 */
export function parseTickets(files: Array<{ path: string; text: string }>): TicketEntry[] {
  const parsed = files.map((f) => parseTicket(f.path, f.text));
  const key = (t: TicketFile, n: string) => `${t.project}/${t.feature}/${Number(n)}`;
  const status = new Map<string, TicketStatus>();
  for (const t of parsed) if (t.readable) status.set(key(t, t.number), t.status);
  return parsed.map((t) =>
    t.readable
      ? { ...t, free: t.status === "bereit" && t.blockers.every((b) => status.get(key(t, b)) === "erledigt") }
      : t,
  );
}

// ── Reader ─────────────────────────────────────────────────────────────────

export function createBrainReader(source: BrainSource) {
  const cache = new Map<string, { at: number; value: Promise<unknown> }>();

  // The one read operation. A result is kept for TTL_MS, failures included, so
  // a GitHub outage is not asked again on every request. A thrown fetch turns
  // into a failed result rather than a cached rejection.
  function cached<T>(key: string, load: () => Promise<T | Failed>): Promise<T | Failed> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T | Failed>;
    const value = load().catch(
      (e: unknown): Failed => ({ ok: false, status: 502, error: e instanceof Error ? e.message : String(e) }),
    );
    cache.set(key, { at: Date.now(), value });
    return value;
  }
  const read = (path: string) => cached<NoteResult>(`note:${path}`, () => source.note(path));
  const listPaths = () => cached<PathsResult>("paths", () => source.paths());

  /** Projects in "Active Now", most recently touched first; `limit` caps the rows. */
  async function readActiveProjects(limit = 8): Promise<BrainProject[]> {
    const note = await read("STATUS.md");
    return note.ok ? parseActiveProjects(note.text).slice(0, limit) : [];
  }

  /**
   * Sessions aller aktiven Projekte, jüngste zuerst. Fehlt eine PROGRESS.md oder
   * der Token, fehlt schlicht dieses Projekt; die Seite bleibt benutzbar.
   */
  async function readSessions(limit = 40): Promise<SessionEntry[]> {
    const [projects, registry] = await Promise.all([readActiveProjects(20), read("Projects/00-Registry.md")]);
    if (projects.length === 0) return [];
    const folders = registry.ok ? parseRegistryFolders(registry.text) : new Map<string, string>();
    const year = new Date().getFullYear();

    const perProject = await Promise.all(
      projects.map(async (p) => {
        const folder = folders.get(p.name) ?? p.name;
        const note = await read(`Projects/${folder}/PROGRESS.md`);
        return note.ok ? parseSessions(note.text, p.name, year) : [];
      }),
    );

    // Gleiche Überschrift zweimal (verdichtete Abschnitte wiederholen sich) nur
    // einmal zeigen.
    const seen = new Set<string>();
    return perProject
      .flat()
      .filter((e) => {
        const k = `${e.project}|${e.date}|${e.title}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async function readLearnings(recentCount = 5): Promise<LearningStats | null> {
    const note = await read("Learnings/INDEX.md");
    return note.ok ? parseLearnings(note.text, recentCount) : null;
  }

  async function readVaultChecks(): Promise<VaultCheck[]> {
    return Promise.all(
      CHECK_QUELLEN.map(async ({ quelle, pfad }) => {
        const note = await read(pfad);
        return { quelle, pfad, ...(note.ok ? parseGeneratorReport(note.text) : { stand: null, meldungen: [] }) };
      }),
    );
  }

  /**
   * Every ticket in the vault, sorted by path (project, feature, number). Fails
   * as a whole only when the file list cannot be read; a single ticket that
   * cannot be read or parsed comes back as unreadable.
   */
  async function readTickets(): Promise<TicketsResult> {
    const all = await listPaths();
    if (!all.ok) return all;
    const paths = all.paths.filter(isTicketPath).sort();

    const files: Array<{ path: string; text: string }> = [];
    const failed: UnreadableTicket[] = [];
    // Ten at a time: GitHub limits concurrent requests per token.
    for (let i = 0; i < paths.length; i += 10) {
      const batch = paths.slice(i, i + 10);
      const notes = await Promise.all(batch.map((p) => read(p)));
      notes.forEach((note, j) => {
        if (note.ok) files.push({ path: batch[j], text: note.text });
        else failed.push(unreadableTicket(batch[j], `GitHub ${note.status}: ${note.error}`));
      });
    }
    const tickets = [...parseTickets(files), ...failed].sort((a, b) => a.path.localeCompare(b.path));
    return { ok: true, tickets };
  }

  return { readActiveProjects, readSessions, readLearnings, readVaultChecks, readTickets };
}

export const { readActiveProjects, readSessions, readLearnings, readVaultChecks, readTickets } = createBrainReader({
  note: (path) => fetchNote(path, null),
  paths: fetchPaths,
});
