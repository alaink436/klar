// Kalender-Feed der geplanten To-dos — zum Abonnieren im iPhone-Kalender.
//
// GET /api/todos/ical?token=<todos:ical-Token>
//
// Warum der Token in der URL steht und nicht im Header: ein Kalender-Abo ruft
// die Adresse selbstständig ab, iOS kann dabei keine Header setzen und kein
// 2FA durchlaufen. Der Token ist deshalb ein eigener, eng geschnittener Scope
// (`todos:ical`), jederzeit widerrufbar unter /admin/brain → Zugang. Wer die
// URL hat, sieht die Titel der geplanten Punkte — mehr nicht.
//
// Punkte ohne Uhrzeit werden GANZTÄGIG ausgegeben (VALUE=DATE), Punkte mit
// Uhrzeit als echter Termin über 30 Minuten.

import { type NextRequest } from "next/server";
import { verifyToken } from "@/lib/apiTokens";
import { listPlannedTodos } from "@/lib/todoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZONE = "Europe/Zurich";

/** RFC 5545: Backslash, Semikolon, Komma escapen, Zeilenumbrüche zu \n. */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 will Zeilen ≤ 75 Oktette, Fortsetzung mit einem Leerzeichen am
 * Zeilenanfang. Ohne das zerlegen manche Clients lange Titel falsch.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

const stamp = (d: Date): string => `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
const dateOnly = (iso: string): string => iso.slice(0, 10).replace(/-/g, "");

/** DTEND ist bei ganztägigen Einträgen exklusiv — sonst fehlt der Tag im Kalender. */
function nextDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return dateOnly(d.toISOString());
}

/**
 * Ortszeit Zürich → UTC-Instant. Der Offset hängt am Datum (MEZ/MESZ), darum
 * wird er für genau diesen Tag ermittelt statt fest verdrahtet: die naive Zeit
 * einmal als UTC lesen, schauen, wie dieser Moment in Zürich aussieht, und die
 * Differenz abziehen. Damit stimmt der Feed auch über die Zeitumstellung.
 */
function zurichToUtc(day: string, time: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  const [hh, mm] = time.slice(0, 5).split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(naive)).map((x) => [x.type, x.value]));
  const asSeenInZurich = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    // Intl liefert Mitternacht je nach Umgebung als "24" — auf 0 normalisieren.
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return new Date(naive - (asSeenInZurich - naive));
}

export async function GET(req: NextRequest): Promise<Response> {
  const raw = req.nextUrl.searchParams.get("token") ?? "";
  const auth = await verifyToken(raw, "todos:ical");
  if (!auth) {
    return new Response("unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const todos = await listPlannedTodos();
  const now = stamp(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Klar Control//To-do//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Klar To-do",
    "X-WR-CALDESC:Geplante Punkte aus Klar Control",
    // Apple fragt sonst gern minütlich nach.
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const t of todos) {
    if (!t.due_on) continue;
    lines.push(
      "BEGIN:VEVENT",
      // Stabile UID: derselbe Punkt bleibt derselbe Eintrag, auch wenn er
      // auf einen anderen Tag rutscht — sonst dupliziert der Kalender ihn.
      `UID:todo-${t.id}@getklar.org`,
      `DTSTAMP:${now}`,
    );
    if (t.due_time) {
      const start = zurichToUtc(t.due_on, t.due_time);
      const end = new Date(start.getTime() + 30 * 60_000);
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(t.due_on)}`, `DTEND;VALUE=DATE:${nextDay(t.due_on)}`);
    }
    lines.push(fold(`SUMMARY:${esc(t.title)}`), "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");

  return new Response(`${lines.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="klar-todos.ics"',
      "Cache-Control": "no-store",
    },
  });
}
