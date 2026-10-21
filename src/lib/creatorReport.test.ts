import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./vault", () => ({ getForProxy: async () => null }));

import type { ModelRun } from "./creatorEarnings";
import { buildWeeklyReport } from "./creatorReport";
import { isTired } from "./formatStats";

const DAY = 86_400_000;
const at = (day: number) => Date.parse("2026-11-01T00:00:00Z") + day * DAY;

describe("isTired", () => {
  it("marks a format whose last week averages under half of its first", () => {
    const posts = [0, 1, 2].map((d) => ({ at: at(d), views: 4000 })).concat([15, 16, 17].map((d) => ({ at: at(d), views: 1500 })));
    expect(isTired(posts)).toBe(true);
  });

  it("does not mark it at exactly half, with too few posts or before two weeks", () => {
    const early = [0, 1, 2].map((d) => ({ at: at(d), views: 4000 }));
    expect(isTired(early.concat([15, 16, 17].map((d) => ({ at: at(d), views: 2000 }))))).toBe(false);
    expect(isTired(early.concat([15, 16].map((d) => ({ at: at(d), views: 100 }))))).toBe(false);
    expect(isTired(early.concat([8, 9, 10].map((d) => ({ at: at(d), views: 100 }))))).toBe(false);
  });
});

describe("buildWeeklyReport", () => {
  const run: ModelRun = {
    run_date: "2026-11-02",
    run_at: "2026-11-02T04:30:00Z",
    rate_per_1000: 0.5,
    rate_source: "prior",
    fitted_rate_per_1000: 0.8,
    days_of_data: 12,
    month: "2026-11-01",
    baseline_signups: 10,
    actual_signups: 16,
    revenue_per_signup_cents: 7,
    extra_revenue_cents: 42,
    cap_cents: 16.8,
    commission_cents: 30,
    cap_factor: 0.56,
    days: [],
  };

  it("names the rate's source, whether the cap bites, tired formats and the creators", () => {
    const { subject, text } = buildWeeklyReport(
      run,
      {
        formats: [
          { formatId: "brain-02", posts: 6, viewsPerPost: 2400, tired: true },
          { formatId: "sleep-02", posts: 0, viewsPerPost: null, tired: false },
        ],
        own: { posts: 9, viewsPerPost: 3100 },
      },
      [{ creator_id: "c1", handle: "lisa", month: "2026-11-01", views: 12_000, est_signups: 6, est_revenue_cents: 42, commission_cents: 21, payable_cents: 11, days: [] }],
    );
    expect(subject).toBe("Creator-Plattform: Woche bis 2026-11-02, 1 müde Formate");
    expect(text).toContain("Prototyp, erst 12 Tage View-Stände");
    expect(text).toContain("Deckel greift: ja, alle auf 56 % gekürzt");
    expect(text).toContain("- brain-02: 2'400 (6 Posts), müde");
    expect(text).toContain("- sleep-02: - (0 Posts)");
    expect(text).toContain("- @lisa: 12'000 Views, 6.0 Anmeldungen, $0.11");
  });
});
