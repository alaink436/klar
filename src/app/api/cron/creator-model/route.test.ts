import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
const report = vi.fn();
vi.mock("@/lib/creatorModelRun", () => ({ runCreatorModel: () => run() }));
vi.mock("@/lib/creatorReport", () => ({ sendWeeklyReport: () => report() }));

import { NextRequest } from "next/server";
import { GET } from "./route";

const req = (auth?: string) => new NextRequest("https://getklar.org/api/cron/creator-model", { headers: auth ? { authorization: auth } : {} });

describe("GET /api/cron/creator-model", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    run.mockReset().mockResolvedValue({ ok: true, ratePer1000: 0.5, rateSource: "prior", creators: 0 });
    report.mockReset().mockResolvedValue(true);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("refuses without the cron secret, and when none is set", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the model daily and sends the report only on Mondays", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T04:30:00Z")); // Tuesday
    expect(await (await GET(req("Bearer s3cret"))).json()).toMatchObject({ ok: true, report: false });
    vi.setSystemTime(new Date("2026-10-26T04:30:00Z")); // Monday
    expect(await (await GET(req("Bearer s3cret"))).json()).toMatchObject({ ok: true, report: true });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("answers 500 with the reason when the run fails", async () => {
    run.mockRejectedValue(new Error("hub 503 klar_posts"));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "hub 503 klar_posts" });
  });
});
