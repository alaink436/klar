import { describe, expect, it } from "vitest";
import { bookingHref, mergeSlots } from "./consultSlots";

describe("mergeSlots", () => {
  it("groups both events into Zurich days, earliest first, automatic wins a shared time", () => {
    const days = mergeSlots({
      consult: ["2026-11-25T08:00:00.000Z", "2026-11-25T12:00:00.000Z"],
      "consult-anfrage": ["2026-11-26T12:00:00.000Z", "2026-11-25T12:00:00.000Z", "2026-11-25T23:30:00.000Z"],
    });
    expect(days.map((d) => d.date)).toEqual(["2026-11-25", "2026-11-26"]);
    expect(days[0].slots.map((s) => [s.time, s.event])).toEqual([
      ["2026-11-25T08:00:00.000Z", "consult"],
      ["2026-11-25T12:00:00.000Z", "consult"],
    ]);
    // 23:30 UTC is already the 26th in Zurich
    expect(days[1].slots.map((s) => s.time)).toEqual(["2026-11-25T23:30:00.000Z", "2026-11-26T12:00:00.000Z"]);
  });

  it("links to the booking form of the event the time belongs to", () => {
    expect(bookingHref("consult-anfrage", "2026-11-25T13:00:00.000Z")).toBe(
      "https://cal.getklar.org/klar/consult-anfrage?month=2026-11&date=2026-11-25&slot=2026-11-25T13%3A00%3A00.000Z",
    );
  });
});
