import { describe, expect, it } from "vitest";
import { parseTickets } from "@/lib/brainReader";
import { ageSince, groupTickets, laneOf, openBlockers, shortComment } from "./ticketGroups";

const FREI = "keine (kann sofort starten)";

function file(project: string, feature: string, n: string, status: string, blockers = FREI) {
  return {
    path: `Projects/${project}/specs/${feature}/issues/${n}-ticket.md`,
    text: `# ${n}: Ticket ${n}\n\nStatus: ${status}\nBlockiert von: ${blockers}\n`,
  };
}

const TICKETS = parseTickets([
  file("Klar", "aufraeumen", "01", "erledigt"),
  file("Klar", "aufraeumen", "02", "bereit", "01 (Eins)"),
  file("Klar", "aufraeumen", "03", "bereit", "04 (Vier)"),
  file("Klar", "aufraeumen", "04", "in Arbeit", "01 (Eins)"),
  file("Klar", "aufraeumen", "05", "verworfen"),
  file("Klar", "aufraeumen", "06", "kaputt"),
  file("Klar", "aufraeumen", "07", "in Arbeit"),
  file("Basalt", "fertig", "01", "erledigt"),
  file("Alpha", "laeuft", "01", "bereit"),
]);

const label = (list: ReturnType<typeof groupTickets>[number]["open"]) => list.map((t) => `${t.number} ${laneOf(t)}`);

describe("groupTickets", () => {
  it("groups by project and feature, groups with open tickets first", () => {
    expect(groupTickets(TICKETS).map((g) => `${g.project}/${g.feature}`)).toEqual([
      "Alpha/laeuft",
      "Klar/aufraeumen",
      "Basalt/fertig",
    ]);
  });

  it("orders in Arbeit, frei, blockiert, nicht lesbar, and keeps erledigt and verworfen apart", () => {
    const klar = groupTickets(TICKETS).find((g) => g.project === "Klar")!;
    expect(label(klar.open)).toEqual([
      "04 in Arbeit",
      "07 in Arbeit",
      "02 frei",
      "03 blockiert",
      "06 nicht lesbar",
    ]);
    expect(label(klar.closed)).toEqual(["01 erledigt", "05 verworfen"]);
  });

  it("does not depend on the input order", () => {
    expect(groupTickets([...TICKETS].reverse())).toEqual(groupTickets(TICKETS));
  });
});

describe("openBlockers", () => {
  it("lists the blockers that are not erledigt, with their lane", () => {
    const t = TICKETS.find((x) => x.project === "Klar" && x.number === "03")!;
    expect(openBlockers(t, TICKETS)).toEqual([{ number: "04", lane: "in Arbeit" }]);
  });

  it("drops erledigt blockers and marks missing ones", () => {
    const list = parseTickets([
      file("P", "f", "01", "erledigt"),
      file("P", "f", "02", "bereit", "01 (Eins), 09 (Neun)"),
    ]);
    expect(openBlockers(list[1], list)).toEqual([{ number: "09", lane: "fehlt" }]);
  });
});

describe("shortComment", () => {
  it("flattens a nested list and drops bold", () => {
    expect(shortComment("2026-10-07: erledigt. PR #26.\n  - **Module:** neu\n  - Alain muss nichts tun.")).toBe(
      "2026-10-07: erledigt. PR #26. · Module: neu · Alain muss nichts tun.",
    );
  });

  it("cuts long text at a word", () => {
    const out = shortComment("wort ".repeat(100), 40);
    expect(out.length).toBeLessThanOrEqual(42);
    expect(out.endsWith("wort …")).toBe(true);
  });
});

describe("ageSince", () => {
  // 17:36 UTC is 19:36 in Zurich (summer time).
  const now = new Date("2026-10-07T17:36:00Z");

  it("reads the time as Zurich time", () => {
    expect(ageSince("2026-10-07 19:21", now)).toBe("vor 15 min");
    expect(ageSince("2026-10-07 16:36", now)).toBe("vor 3 h");
    expect(ageSince("2026-10-05 19:36", now)).toBe("vor 2 Tagen");
  });
});
