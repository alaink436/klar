// SERVER ONLY. Reads the "Active Now" table out of AI-Brain/STATUS.md so the
// admin overview can answer "what am I working on and how far did I get?"
// without a second place to maintain. STATUS.md is already the dashboard I
// keep by hand after every session; this just parses it.
//
// Deliberately tolerant: STATUS.md is prose written for humans, so anything
// that does not parse is skipped rather than thrown. A missing GitHub token
// or a renamed heading degrades to an empty list and the overview hides the
// section — it never breaks the page.

import { fetchNote } from "@/lib/brainVault";

export interface BrainProject {
  name: string;
  /** "MM-DD" as written in the table. */
  touch: string;
  /** Days since that date, or null if it did not parse. */
  daysAgo: number | null;
  /** First sentence of the Phase column — where the project stands. */
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
 * where the thing stands — everything after it is history.
 */
function firstClause(text: string, max = 150): string {
  const t = plain(text);
  // Split on sentence end or the "·"/"—" the status lines use as separators.
  const m = t.match(/^(.{20,}?)(?:\.\s|\s—\s|\s·\s|;\s)/);
  const head = (m ? m[1] : t).trim();
  return head.length > max ? `${head.slice(0, max - 1).trimEnd()}…` : head;
}

function daysSince(mmdd: string): number | null {
  const m = mmdd.match(/^(\d{2})-(\d{2})$/);
  if (!m) return null;
  const now = new Date();
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

/**
 * Projects under the "Active Now" heading, most recently touched first.
 * `limit` caps how many rows come back (the overview shows a handful).
 */
export async function readActiveProjects(limit = 8): Promise<BrainProject[]> {
  const note = await fetchNote("STATUS.md", null);
  if (!note.ok) return [];

  const lines = note.text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s.*Active Now/i.test(l));
  if (start === -1) return [];

  const projects: BrainProject[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break; // next section — done
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
      daysAgo: daysSince(touch),
      phase: firstClause(c[2]),
      next: nextItems,
      blockers: nextItems.filter((s) => s.includes("🔴")),
    });
  }

  projects.sort((a, b) => (a.daysAgo ?? 999) - (b.daysAgo ?? 999));
  return projects.slice(0, limit);
}
