import { describe, expect, it } from "vitest";
import { HOUR, estimateMonth, fitRate, freshViews } from "./creatorModel";

const T0 = Date.parse("2026-10-01T00:00:00Z");

describe("freshViews", () => {
  it("spreads the first stretch with a decay and later stretches evenly, keeping the total", () => {
    const v = freshViews(T0, [{ at: T0 + 6 * HOUR, views: 600 }, { at: T0 + 12 * HOUR, views: 900 }], T0, 24);
    expect(v.slice(0, 6).reduce((a, b) => a + b, 0)).toBeCloseTo(600);
    expect(v[0]).toBeGreaterThan(v[5]); // early hours get more
    expect([...v.slice(6, 12)].every((x) => Math.abs(x - 50) < 1e-9)).toBe(true);
    expect(v.reduce((a, b) => a + b, 0)).toBeCloseTo(900);
  });

  it("drops what lies outside the window and ignores a shrinking count", () => {
    const v = freshViews(T0 - 10 * HOUR, [{ at: T0 + 2 * HOUR, views: 1200 }, { at: T0 + 4 * HOUR, views: 1100 }], T0, 4);
    const inside = v.reduce((a, b) => a + b, 0);
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThan(1200);
  });
});

describe("fitRate", () => {
  it("recovers the rate from noisy sign-ups with a daily rhythm", () => {
    const hours = 28 * 24;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const exposure = new Float64Array(hours);
    for (let p = 0; p < 60; p++) {
      const start = Math.floor(rnd() * (hours - 48));
      const views = 2000 + rnd() * 8000;
      const f = freshViews(T0 + start * HOUR, [{ at: T0 + (start + 48) * HOUR, views }], T0, hours);
      for (let h = 0; h < hours; h++) exposure[h] += f[h];
    }
    const signups = Array.from({ length: hours }, (_, h) => {
      const base = 0.3 + 0.25 * Math.sin(((h % 24) / 24) * 2 * Math.PI);
      const mean = Math.max(0, base) + 0.5 * (exposure[h] / 1000);
      return mean + (rnd() - 0.5) * 0.4; // noise
    });
    const fit = fitRate(signups, exposure, T0)!;
    expect(fit.ratePer1000).toBeGreaterThan(0.45);
    expect(fit.ratePer1000).toBeLessThan(0.55);
    expect(fit.baseline.length).toBe(hours);

    // With the rate given, the baseline still comes out at the true 0.3 per hour on average.
    const fixed = fitRate(signups, exposure, T0, 0.5)!;
    expect(fixed.ratePer1000).toBe(0.5);
    expect(fixed.baseline.reduce((a, b) => a + b, 0) / hours).toBeCloseTo(0.3, 1);
  });

  it("takes a flat baseline from a few hours, where hour of day can't be told apart", () => {
    const fit = fitRate([2, 4, 3, 1, 5, 3], [0, 0, 0, 0, 0, 0], T0 + 9 * HOUR, 0.5)!;
    expect([...fit.baseline].every((b) => Math.abs(b - 3) < 1e-9)).toBe(true);
    expect(fitRate([2, 4, 3], [0, 1000, 0], T0)).not.toBeNull();
  });
});

describe("estimateMonth", () => {
  const base = { ratePer1000: 0.5, revenuePerSignupCents: 100, baselineSignups: 100 };

  it("pays 50 % of the revenue his views brought when the cap does not bite", () => {
    const e = estimateMonth({ ...base, actualSignups: 200, creators: [{ creatorId: "a", views: 40_000 }] });
    expect(e.creators[0]).toMatchObject({ signups: 20, revenueCents: 2000, commissionCents: 1000, payableCents: 1000 });
    expect(e.capCents).toBe(4000); // 40 % of (200 - 100) x 100
    expect(e.capFactor).toBe(1);
  });

  it("cuts everyone by the same factor when the creators would get more than 40 % of the extra revenue", () => {
    const e = estimateMonth({ ...base, actualSignups: 110, creators: [{ creatorId: "a", views: 40_000 }, { creatorId: "b", views: 20_000 }] });
    expect(e.capCents).toBe(400);
    expect(e.capFactor).toBeCloseTo(400 / 1500);
    expect(e.creators.map((c) => c.payableCents)).toEqual([266, 133]);
  });

  it("pays nothing when there was no extra revenue at all", () => {
    const e = estimateMonth({ ...base, actualSignups: 90, creators: [{ creatorId: "a", views: 40_000 }] });
    expect(e.creators[0].payableCents).toBe(0);
  });
});
