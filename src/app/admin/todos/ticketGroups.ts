// Grouping and ordering for the Ticket-Ansicht, kept pure so it is testable
// without GitHub. The page only renders what comes out of here.

import type { TicketEntry } from "@/lib/brainReader";

/** Where a ticket sits in the view; "frei" and "blockiert" split status "bereit". */
export type TicketLane = "in Arbeit" | "frei" | "blockiert" | "nicht lesbar" | "erledigt" | "verworfen";

const ORDER: TicketLane[] = ["in Arbeit", "frei", "blockiert", "nicht lesbar", "erledigt", "verworfen"];

export function laneOf(t: TicketEntry): TicketLane {
  if (!t.readable) return "nicht lesbar";
  if (t.status === "bereit") return t.free ? "frei" : "blockiert";
  return t.status;
}

export interface TicketGroup {
  project: string;
  feature: string;
  /** In Arbeit, frei, blockiert, nicht lesbar, in that order. */
  open: TicketEntry[];
  /** Erledigt and verworfen; the view shows them collapsed. */
  closed: TicketEntry[];
}

/**
 * One group per project and feature. Groups with open tickets come first, so
 * running work stays on top; within that, by project and feature. Inside a
 * group, by lane and then by ticket number.
 */
export function groupTickets(tickets: TicketEntry[]): TicketGroup[] {
  const groups = new Map<string, TicketGroup>();
  for (const t of tickets) {
    const key = `${t.project}/${t.feature}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { project: t.project, feature: t.feature, open: [], closed: [] }));
    const lane = laneOf(t);
    (lane === "erledigt" || lane === "verworfen" ? g.closed : g.open).push(t);
  }
  const byLane = (a: TicketEntry, b: TicketEntry) =>
    ORDER.indexOf(laneOf(a)) - ORDER.indexOf(laneOf(b)) || Number(a.number) - Number(b.number);
  for (const g of groups.values()) {
    g.open.sort(byLane);
    g.closed.sort(byLane);
  }
  return [...groups.entries()]
    .sort(([ka, a], [kb, b]) => Number(b.open.length > 0) - Number(a.open.length > 0) || ka.localeCompare(kb))
    .map(([, g]) => g);
}

/** The blockers of `t` that are not "erledigt" yet, with their status ("fehlt" when there is no such ticket). */
export function openBlockers(t: TicketEntry, all: TicketEntry[]): Array<{ number: string; lane: TicketLane | "fehlt" }> {
  if (!t.readable) return [];
  return t.blockers
    .map((n) => {
      const b = all.find((x) => x.project === t.project && x.feature === t.feature && Number(x.number) === Number(n));
      return { number: n, lane: b ? laneOf(b) : ("fehlt" as const) };
    })
    .filter((b) => b.lane !== "erledigt");
}

/** The last comment as one line: list markers and bold dropped, cut at a word near `max`. */
export function shortComment(text: string, max = 280): string {
  const flat = text
    .split("\n")
    .map((l) => l.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean)
    .join(" · ")
    .replace(/\*\*/g, "");
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s·,;:.]+$/, "")} …`;
}

/**
 * "vor 3 h", "vor 2 Tagen" for a "YYYY-MM-DD HH:MM" in Zurich time. Both sides are
 * compared as Zurich wall-clock time, so the zone offset cancels out.
 */
export function ageSince(takenAt: string, now = new Date()): string | null {
  const then = Date.parse(`${takenAt.replace(" ", "T")}:00Z`);
  const here = Date.parse(`${now.toLocaleString("sv-SE", { timeZone: "Europe/Zurich" }).replace(" ", "T")}Z`);
  if (!Number.isFinite(then) || !Number.isFinite(here)) return null;
  const min = Math.max(0, Math.round((here - then) / 60_000));
  if (min < 60) return `vor ${min} min`;
  if (min < 48 * 60) return `vor ${Math.round(min / 60)} h`;
  return `vor ${Math.round(min / (24 * 60))} Tagen`;
}
