import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrainReader, parseTickets, type BrainSource, type TicketEntry } from "./brainReader";

// A small vault: real tickets copied from the AI-Brain, plus made-up ones for
// the formats the real ones do not cover yet.
const ROOT = fileURLToPath(new URL("./__fixtures__/brain", import.meta.url));
const KLAR = "Projects/Klar/specs/klar-control-entruempeln/issues";
const INDEX = "Projects/AI-Brain-Hosting/specs/brain-index/issues";
const PROBE = "Projects/Probe/specs/ticket-formate/issues";

// Sample-file adapter in place of GitHub. Records every note it hands out.
function sampleVault(overrides: Partial<BrainSource> = {}) {
  const reads: string[] = [];
  const source: BrainSource = {
    async note(path) {
      reads.push(path);
      try {
        return { ok: true, text: readFileSync(join(ROOT, path), "utf-8"), name: path };
      } catch {
        return { ok: false, status: 404, error: "Not Found" };
      }
    },
    async paths() {
      const all = readdirSync(ROOT, { recursive: true }) as string[];
      return { ok: true, paths: all.map((p) => p.split(sep).join("/")).filter((p) => p.endsWith(".md")) };
    },
    ...overrides,
  };
  return { reader: createBrainReader(source), reads };
}

async function tickets(overrides: Partial<BrainSource> = {}) {
  const res = await sampleVault(overrides).reader.readTickets();
  if (!res.ok) throw new Error(res.error);
  return res.tickets;
}

function at(list: TicketEntry[], path: string): TicketEntry {
  const t = list.find((e) => e.path === path);
  if (!t) throw new Error(`no ticket ${path}`);
  return t;
}

describe("readTickets", () => {
  it("reads only files named issues/<NN>-<slug>.md under a spec", async () => {
    const { reader, reads } = sampleVault();
    const res = await reader.readTickets();
    expect(res.ok).toBe(true);
    expect(reads.every((p) => /\/specs\/[^/]+\/issues\/\d+-[^/]+\.md$/.test(p))).toBe(true);
    expect(reads).not.toContain(`${PROBE}/notizen.md`);
    expect(reads).not.toContain("Projects/Probe/specs/ticket-formate/spec.md");
    expect(res.ok && res.tickets.map((t) => t.path)).toEqual([
      `${INDEX}/01-eine-datei-eine-frage.md`,
      `${INDEX}/02-gute-treffer.md`,
      `${KLAR}/01-sicherungspunkt-testgeruest-rundgang.md`,
      `${KLAR}/02-cal-admin-und-mycakeday-loeschen.md`,
      `${KLAR}/03-outreach-loeschen.md`,
      `${KLAR}/04-affiliate-in-klar-control-loeschen.md`,
      `${KLAR}/09-brain-reader-mit-ticket-leser.md`,
      `${PROBE}/01-windows-zeilenenden.md`,
      `${PROBE}/02-verworfen.md`,
      `${PROBE}/03-kaputt.md`,
      `${PROBE}/04-wartet-auf-kaputtes.md`,
    ]);
  });

  it("reads a ticket in progress with its session line", async () => {
    expect(at(await tickets(), `${KLAR}/02-cal-admin-und-mycakeday-loeschen.md`)).toEqual({
      path: `${KLAR}/02-cal-admin-und-mycakeday-loeschen.md`,
      project: "Klar",
      feature: "klar-control-entruempeln",
      number: "02",
      url: `https://github.com/alaink436/AI-Brain/blob/master/${KLAR}/02-cal-admin-und-mycakeday-loeschen.md`,
      readable: true,
      title: "Cal Admin und MyCakeDay löschen",
      status: "in Arbeit",
      blockers: ["01"],
      progress: { done: 0, total: 6 },
      sessionTitle: "Klar Dashboard entrümpeln (Sub-Agent 02)",
      takenAt: "2026-10-07 21:11",
      lastComment: null,
      free: false,
    });
  });

  it("has no session without a session line", async () => {
    expect(at(await tickets(), `${KLAR}/09-brain-reader-mit-ticket-leser.md`)).toMatchObject({
      status: "bereit",
      sessionTitle: null,
      takenAt: null,
    });
  });

  it("reads blockers: none, and numbers whose titles hold commas", async () => {
    const list = await tickets();
    expect(at(list, `${KLAR}/01-sicherungspunkt-testgeruest-rundgang.md`)).toMatchObject({ blockers: [] });
    expect(at(list, `${INDEX}/01-eine-datei-eine-frage.md`)).toMatchObject({ blockers: [] });
    expect(at(list, `${KLAR}/04-affiliate-in-klar-control-loeschen.md`)).toMatchObject({ blockers: ["01", "03"] });
    expect(at(list, `${INDEX}/02-gute-treffer.md`)).toMatchObject({ blockers: ["01"] });
  });

  it("takes the last comment with its nested lines", async () => {
    const list = await tickets();
    const klar01 = at(list, `${KLAR}/01-sicherungspunkt-testgeruest-rundgang.md`);
    expect(klar01).toMatchObject({ progress: { done: 6, total: 6 } });
    const c = klar01.readable ? klar01.lastComment : null;
    expect(c).toMatch(/^2026-10-07: erledigt\. PR https:\/\/github\.com\/alaink436\/klar\/pull\/23/);
    expect(c).toContain("\n- **Sicherungspunkt:**");
    expect(c).toMatch(/\n- Alain muss nichts tun\.$/);

    // Several top-level comments: only the last one.
    const index01 = at(list, `${INDEX}/01-eine-datei-eine-frage.md`);
    expect(index01.readable && index01.lastComment).toBe(
      "Für 02: der Ersatz für die Einbettung ist ein Wortbeutel (Wörter ab 4 Zeichen). Exakt-Treffer bringt erst der Volltext aus 02.",
    );
  });

  it("reads Windows line endings, and a session title with commas", async () => {
    const path = `${PROBE}/01-windows-zeilenenden.md`;
    expect(readFileSync(join(ROOT, path), "utf-8")).toContain("\r\n"); // the sample really is CRLF
    expect(at(await tickets(), path)).toMatchObject({
      readable: true,
      title: "Windows-Zeilenenden",
      status: "in Arbeit",
      blockers: [],
      progress: { done: 1, total: 3 },
      sessionTitle: "Probe, mit Komma, seit gestern",
      takenAt: "2026-10-07 09:30",
      lastComment: "2026-10-07: Zwischenstand.\n- Detail eins\n- Detail zwei",
    });
  });

  it("knows all four statuses", async () => {
    const statuses = new Set((await tickets()).flatMap((t) => (t.readable ? [t.status] : [])));
    expect([...statuses].sort()).toEqual(["bereit", "erledigt", "in Arbeit", "verworfen"]);
  });

  it("marks the frontier: bereit and every blocker erledigt", async () => {
    const free = (await tickets()).filter((t) => t.readable && t.free).map((t) => t.path);
    // 09 waits for 01 (erledigt). 04 waits for 03 (in Arbeit). Probe 04 waits for
    // an unreadable ticket. In Arbeit, erledigt and verworfen are never free.
    expect(free).toEqual([`${KLAR}/09-brain-reader-mit-ticket-leser.md`]);
  });

  it("shows a broken ticket as unreadable instead of dropping it", async () => {
    expect(at(await tickets(), `${PROBE}/03-kaputt.md`)).toEqual({
      path: `${PROBE}/03-kaputt.md`,
      project: "Probe",
      feature: "ticket-formate",
      number: "03",
      url: `https://github.com/alaink436/AI-Brain/blob/master/${PROBE}/03-kaputt.md`,
      readable: false,
      reason: "Status fehlt",
    });
  });

  it("shows a ticket GitHub could not deliver as unreadable", async () => {
    const list = await tickets({
      async note() {
        return { ok: false, status: 502, error: "Bad Gateway" };
      },
    });
    expect(list).toHaveLength(11);
    expect(list.every((t) => !t.readable && t.reason === "GitHub 502: Bad Gateway")).toBe(true);
  });

  it("fails as a whole when the file list cannot be read", async () => {
    const { reader } = sampleVault({
      async paths() {
        return { ok: false, status: 503, error: "BRAIN_GITHUB_TOKEN missing" };
      },
    });
    expect(await reader.readTickets()).toEqual({ ok: false, status: 503, error: "BRAIN_GITHUB_TOKEN missing" });
  });
});

describe("parseTickets", () => {
  const path = `${PROBE}/05-probe.md`;
  const ticket = (head: string) => `# 05: Probe\n\n${head}\nAufwand: 1 h\n\n- [ ] Etwas\n`;

  it.each([
    ["Status: fertig\nBlockiert von: keine", "Status unbekannt: fertig"],
    ["Status: bereit", "Blockiert von fehlt"],
    ["Status: bereit\nBlockiert von: 01 (offen", "Blockiert von unlesbar: 01 (offen"],
    ["Status: bereit\nBlockiert von: siehe oben", "Blockiert von unlesbar: siehe oben"],
    ["Status: in Arbeit\nSession: Agent 05\nBlockiert von: keine", "Session-Zeile unlesbar: Agent 05"],
    ["Status: in Arbeit\nSession: Agent 05, seit gestern\nBlockiert von: keine", "Session-Zeile unlesbar: Agent 05, seit gestern"],
  ])("unreadable: %s", (head, reason) => {
    expect(parseTickets([{ path, text: ticket(head) }])[0]).toMatchObject({ readable: false, reason });
  });

  it("unreadable without a title line", () => {
    expect(parseTickets([{ path, text: "Status: bereit\nBlockiert von: keine\n" }])[0]).toMatchObject({
      readable: false,
      reason: "Titelzeile fehlt (# NN: Titel)",
    });
  });

  it("is not free when a blocker is missing from the feature", () => {
    expect(parseTickets([{ path, text: ticket("Status: bereit\nBlockiert von: 07 (Gibt es nicht)") }])[0]).toMatchObject({
      readable: true,
      free: false,
    });
  });
});

describe("cache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches STATUS.md once for the Chronik, which needs it twice", async () => {
    const { reader, reads } = sampleVault();
    await Promise.all([reader.readActiveProjects(20), reader.readSessions(60)]);
    expect(reads.filter((p) => p === "STATUS.md")).toHaveLength(1);
  });

  it("keeps a read for about 60 seconds", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const { reader, reads } = sampleVault();
    await reader.readActiveProjects();
    vi.setSystemTime(59_000);
    await reader.readActiveProjects();
    expect(reads).toEqual(["STATUS.md"]);
    vi.setSystemTime(61_000);
    await reader.readActiveProjects();
    expect(reads).toEqual(["STATUS.md", "STATUS.md"]);
  });
});

describe("existing readers", () => {
  it("reads Active Now from STATUS.md", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 7, 12));
    try {
      const projects = await sampleVault().reader.readActiveProjects();
      expect(projects).toEqual([
        {
          name: "Klar",
          touch: "10-07",
          daysAgo: 0,
          phase: "Klar Control entrümpeln läuft",
          next: ["🔴 Ticket 03 mergen", "Ticket-Ansicht bauen"],
          blockers: ["🔴 Ticket 03 mergen"],
        },
        {
          name: "AI-Brain-Hosting",
          touch: "10-05",
          daysAgo: 2,
          phase: "Brain-Index in Betrieb (2026-10-07): 4813 Abschnitte",
          next: ["Abgleich montags prüfen"],
          blockers: [],
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads sessions from the PROGRESS.md of active projects", async () => {
    const year = new Date().getFullYear();
    expect(await sampleVault().reader.readSessions()).toEqual([
      { date: "2026-10-07", project: "Klar", title: "S106 Mail-Empfang getklar.org" },
      { date: `${year}-10-06`, project: "Klar", title: "S104 Login-Seite ohne Schlüssel" },
    ]);
  });

  it("collects what the generators report", async () => {
    const checks = await sampleVault().reader.readVaultChecks();
    expect(checks[0]).toEqual({
      quelle: "Dashboard",
      pfad: "STATUS.md",
      stand: "2026-10-07",
      meldungen: ["Projects/Probe/PROGRESS.md: Kopf next über 300 Zeichen"],
    });
    expect(checks.slice(1).every((c) => c.meldungen.length === 0)).toBe(true);
  });
});
