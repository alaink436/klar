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
// Ausgegeben werden GANZTÄGIGE Einträge (VALUE=DATE). Eine Uhrzeit würde eine
// Zeitzone erfinden, die es in den Daten nicht gibt: geplant wird ein Tag.

import { type NextRequest } from "next/server";
import { verifyToken } from "@/lib/apiTokens";
import { listPlannedTodos } from "@/lib/todoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      `DTSTART;VALUE=DATE:${dateOnly(t.due_on)}`,
      `DTEND;VALUE=DATE:${nextDay(t.due_on)}`,
      fold(`SUMMARY:${esc(t.title)}`),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
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
