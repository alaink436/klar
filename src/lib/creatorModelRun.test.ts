import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { HOUR } from "./creatorModel";
import { runCreatorModel } from "./creatorModelRun";

// Three days of snapshots on 21.-23.10.: one own post, one counted post of
// lisa (no link), one of a link creator, one creator post without Basalt.
const NOW = Date.parse("2026-10-24T04:30:00Z");
const T = (s: string) => new Date(Date.parse(s)).toISOString();
const posts = [
  { post_id: "own1", handle: "motivationwithbasalt", posted_at: T("2026-10-21T08:00:00Z") },
  { post_id: "lisa1", handle: "lisa", posted_at: T("2026-10-22T08:00:00Z") },
  { post_id: "max1", handle: "max", posted_at: T("2026-10-22T09:00:00Z") },
  { post_id: "lisa2", handle: "lisa", posted_at: T("2026-10-22T10:00:00Z") },
];
const views = [
  { post_id: "own1", fetched_at: T("2026-10-21T10:00:00Z"), views: 4000 },
  { post_id: "own1", fetched_at: T("2026-10-23T10:00:00Z"), views: 9000 },
  { post_id: "lisa1", fetched_at: T("2026-10-23T08:00:00Z"), views: 20_000 },
  { post_id: "max1", fetched_at: T("2026-10-23T08:00:00Z"), views: 50_000 },
  { post_id: "lisa2", fetched_at: T("2026-10-23T08:00:00Z"), views: 70_000 },
];
const checks = [
  { post_id: "lisa1", creator_id: "c-lisa", status: "counts" },
  { post_id: "max1", creator_id: "c-max", status: "link" },
  { post_id: "lisa2", creator_id: "c-lisa", status: "no_mention" },
];

describe("runCreatorModel", () => {
  const writes: Record<string, Array<Record<string, unknown>>> = {};
  let noSnapshots = false;
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    vi.stubEnv("KLAR_ADMIN_APPS", JSON.stringify([{ slug: "wavelength", name: "Basalt", supabaseUrl: "https://basalt.test", serviceKey: "k" }]));
    for (const k of Object.keys(writes)) delete writes[k];
    noSnapshots = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const json = (x: unknown) => new Response(JSON.stringify(x));
        if (init?.method === "POST" && url.includes("klar_app_signups_hourly")) {
          // 1 sign-up every hour, 3 more in the hour after lisa1 went up.
          const rows = [];
          for (let t = Date.parse("2026-10-21T09:00:00Z"); t < NOW; t += HOUR) {
            rows.push({ hour: new Date(t).toISOString(), signups: t === Date.parse("2026-10-22T08:00:00Z") ? 4 : 1 });
          }
          return json(rows);
        }
        if (init?.method === "POST") {
          const table = url.split("/rest/v1/")[1];
          writes[table] = JSON.parse(String(init.body));
          return new Response(null, { status: 201 });
        }
        if (url.includes("klar_post_views?select=fetched_at")) return json(noSnapshots ? [] : [views[0]]);
        if (url.includes("klar_view_accounts")) {
          return json([
            { handle: "motivationwithbasalt", source: "own" },
            { handle: "lisa", source: "creator" },
            { handle: "max", source: "creator" },
          ]);
        }
        if (url.includes("klar_post_checks")) return json(url.includes("offset=0") ? checks : []);
        if (url.includes("klar_app_metrics_daily")) return json([{ revenue_28d_cents: 2600, users_new_30d: 260 }]);
        if (url.includes("klar_posts")) return json(url.includes("offset=0") ? posts : []);
        if (url.includes("klar_post_views")) return json(url.includes("offset=0") ? views : []);
        return json([]);
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the prior rate before 14 days and pays only lisa's counted post", async () => {
    const r = await runCreatorModel(NOW);
    expect(r).toMatchObject({ ok: true, ratePer1000: 0.5, rateSource: "prior", creators: 1 });
    const [run] = writes.klar_model_runs;
    expect(run).toMatchObject({ app_slug: "basalt", run_date: "2026-10-24", month: "2026-10-01", rate_source: "prior", days_of_data: 2 });
    expect(run.revenue_per_signup_cents).toBe(10);
    // Window from the first snapshot (21.10. 10:00) to 24.10. 04:00: 66 hours at 1, plus 3.
    expect(run.actual_signups).toBe(69);
    const [lisa] = writes.klar_creator_earnings;
    // 20 000 views x 0.5 per 1000 = 10 sign-ups x 10 cents = 100 cents, half of it hers.
    expect(lisa).toMatchObject({ creator_id: "c-lisa", month: "2026-10-01", views: 20_000, payable_cents: 50 });
    expect(lisa.est_signups).toBeCloseTo(10);
    expect(lisa.commission_cents).toBeCloseTo(50);
    expect(writes.klar_creator_earnings).toHaveLength(1); // max is paid through his link, lisa2 is not about us
  });

  it("refuses to run before the first view snapshot", async () => {
    noSnapshots = true;
    expect(await runCreatorModel(NOW)).toEqual({ ok: false, error: "noch keine View-Stände" });
  });
});
