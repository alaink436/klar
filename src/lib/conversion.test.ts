import { describe, expect, it } from "vitest";
import {
  formatShare,
  funnelBars,
  isPlatform,
  lastWeeks,
  markAt,
  parseChange,
  rangeOf,
  share,
  stepCounts,
  summarize,
  trendPoints,
  weekOf,
  type FunnelRow,
} from "./conversion";

const row = (week: string, build: string, neu: number, paywall = 0, klick = 0, trials = 0, direkt = 0, app = "basalt"): FunnelRow => ({
  app,
  week,
  build,
  neu,
  paywall,
  klick,
  trials,
  direkt,
});

describe("conversion", () => {
  it("starts weeks on Monday and lists them oldest first, ending with the running one", () => {
    expect(weekOf(new Date("2026-11-16T10:00:00Z"))).toBe("2026-11-16");
    expect(weekOf(new Date("2026-11-15T23:59:00Z"))).toBe("2026-11-09");
    expect(lastWeeks(new Date("2026-11-18T08:00:00Z"), 3)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("adds builds up per week and fills empty weeks with zeros", () => {
    const weeks = ["2026-11-02", "2026-11-09", "2026-11-16"];
    const rows = [row("2026-11-09", "33", 48, 37), row("2026-11-09", "35", 52, 38, 1), row("2026-11-16", "37", 15, 13, 2)];
    const { weeks: perWeek } = summarize(rows, "basalt", weeks);
    expect(perWeek.map((w) => w.steps.neu)).toEqual([0, 100, 15]);
    expect(perWeek[1].steps).toEqual({ neu: 100, paywall: 75, klick: 1, trials: 0, direkt: 0 });
  });

  it("keeps other apps and weeks outside the window out", () => {
    const rows = [row("2026-11-09", "66", 27, 18, 2, 1, 1, "kelva"), row("2026-09-28", "20", 32), row("2026-11-09", "33", 4)];
    const { weeks, builds } = summarize(rows, "basalt", ["2026-11-09"]);
    expect(weeks[0].steps.neu).toBe(4);
    expect(builds).toEqual([]);
  });

  it("lists builds with enough new users, newest first, over all weeks", () => {
    const rows = [row("2026-11-02", "25", 159, 142, 20, 3, 2), row("2026-10-26", "25", 66, 57, 11, 3), row("2026-11-09", "33", 48), row("2026-11-09", "37", 2)];
    const { builds } = summarize(rows, "basalt", ["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(builds.map((b) => b.build)).toEqual(["33", "25"]);
    expect(builds[1].steps).toEqual({ neu: 225, paywall: 199, klick: 31, trials: 6, direkt: 2 });
  });

  it("shows a share as Alain writes it, and a dash when there is nothing to divide by", () => {
    expect(formatShare(share(5, 144))).toBe("3,5 %");
    expect(formatShare(share(34, 258))).toBe("13 %");
    expect(formatShare(share(0, 12))).toBe("0 %");
    expect(formatShare(share(1, 0))).toBe("–");
  });

  it("reads PostHog's funnel steps in their order and skips anything else", () => {
    const answer = [
      { order: 1, count: 801, custom_name: "Paywall gesehen" },
      { order: 0, count: 923, custom_name: "Installiert" },
      { order: 3, count: 22 },
      { order: 2, count: 84 },
      { order: "x", count: 1 },
    ];
    expect(stepCounts(answer)).toEqual([923, 801, 84, 22]);
    expect(stepCounts({ error: "nope" })).toEqual([]);
  });

  it("gives each bar its share of step 1 and of the step before, and who dropped off", () => {
    const bars = funnelBars([923, 801, 84, 22]);
    expect(bars[0]).toEqual({ count: 923, ofFirst: 1, ofPrev: null, dropped: 0, droppedOfFirst: 0 });
    expect(formatShare(bars[2].ofPrev)).toBe("10 %");
    expect(bars[2].dropped).toBe(717);
    expect(formatShare(bars[3].ofFirst)).toBe("2,4 %");
    expect(funnelBars([0, 0, 0, 0])[1].ofFirst).toBeNull();
  });

  it("takes only the offered ranges, 30 days otherwise", () => {
    expect(rangeOf("7")).toBe(7);
    expect(rangeOf("90")).toBe(90);
    expect(rangeOf("365")).toBe(30);
    expect(rangeOf(undefined)).toBe(30);
  });

  it("reads PostHog's funnel trend points with the people behind each rate", () => {
    const answer = [
      {
        days: ["2026-11-11", "2026-11-12", 3],
        data: [80.77, 76.92, 1],
        reached_from_step_count: [52, 26, 1],
        reached_to_step_count: [42, 20, 1],
      },
    ];
    expect(trendPoints(answer)).toEqual([
      { day: "2026-11-11", rate: 80.77, reached: 42, of: 52 },
      { day: "2026-11-12", rate: 76.92, reached: 20, of: 26 },
    ]);
    expect(trendPoints(null)).toEqual([]);
  });

  it("puts a change into its bucket of the graph, and nowhere outside it", () => {
    const weeks = [{ day: "2026-11-01" }, { day: "2026-11-08" }, { day: "2026-11-15" }];
    expect(markAt("2026-11-08", weeks, "week")).toBe(0.5);
    expect(markAt("2026-11-11", weeks, "week")).toBeCloseTo((1 + 3 / 7) / 2);
    expect(markAt("2026-11-21", weeks, "week")).toBe(1);
    expect(markAt("2026-10-31", weeks, "week")).toBeNull();
    expect(markAt("2026-11-22", weeks, "week")).toBeNull();
    expect(markAt("2026-11-14", [{ day: "2026-11-13" }, { day: "2026-11-14" }], "day")).toBe(1);
  });

  it("takes a change only with a real past day and one short line", () => {
    expect(parseChange(" 2026-11-14 ", " Gratiswoche wieder vorgewählt (OTA) ", "2026-11-16")).toEqual({ day: "2026-11-14", text: "Gratiswoche wieder vorgewählt (OTA)" });
    expect(parseChange("2026-11-31", "x", "2026-12-05")).toHaveProperty("error");
    expect(parseChange("14.11.2026", "x", "2026-11-16")).toHaveProperty("error");
    expect(parseChange("2026-11-17", "x", "2026-11-16")).toHaveProperty("error");
    expect(parseChange("2026-11-14", "zwei\nZeilen", "2026-11-16")).toHaveProperty("error");
    expect(parseChange("2026-11-14", "x".repeat(201), "2026-11-16")).toHaveProperty("error");
    expect(parseChange("2026-11-14", "   ", "2026-11-16")).toHaveProperty("error");
  });

  it("knows only the offered platforms", () => {
    expect(isPlatform("ios")).toBe(true);
    expect(isPlatform("android")).toBe(true);
    expect(isPlatform("web")).toBe(false);
    expect(isPlatform("toString")).toBe(false);
  });
});
