// Acceptance test of ticket 05: the model, run over Basalt 13.09. to 20.10.2026,
// finds the prototype's rate (0.5 sign-ups per 1000 views, band 0.26 to 0.73).
// Live: needs an Apify scrape of Basalt's posts (BACKTEST_SCRAPE, a JSON file as
// in Projects/Klar/attribution-prototyp) and Basalt's database (BASALT_URL,
// BASALT_KEY) for klar_app_signups_hourly. Skipped without them.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOUR, fitRate, freshViews } from "./creatorModel";

const SCRAPE = process.env.BACKTEST_SCRAPE;
const URL_ = process.env.BASALT_URL;
const KEY = process.env.BASALT_KEY;

describe.skipIf(!SCRAPE || !URL_ || !KEY)("backtest on Basalt", () => {
  it("finds the prototype's rate", async () => {
    const from = Date.parse("2026-09-13T00:00:00Z");
    const to = Date.parse("2026-10-21T00:00:00Z");
    const hours = (to - from) / HOUR;

    const res = await fetch(`${URL_}/rest/v1/rpc/klar_app_signups_hourly`, {
      method: "POST",
      headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_since: new Date(from).toISOString() }),
    });
    const rows = (await res.json()) as Array<{ hour: string; signups: number }>;
    const signups = new Float64Array(hours);
    for (const r of rows) {
      const h = (Date.parse(r.hour) - from) / HOUR;
      if (h >= 0 && h < hours) signups[h] = r.signups;
    }

    // Lifetime views only, so one snapshot a week after posting, as the prototype did.
    const exposure = new Float64Array(hours);
    for (const p of JSON.parse(readFileSync(SCRAPE!, "utf8")) as Array<{ createTime: number; playCount: number }>) {
      const at = p.createTime * 1000;
      if (at < from || at >= to) continue;
      const f = freshViews(at, [{ at: at + 168 * HOUR, views: p.playCount }], from, hours);
      for (let h = 0; h < hours; h++) exposure[h] += f[h];
    }

    const fit = fitRate(signups, exposure, from)!;
    console.log(`sign-ups ${signups.reduce((a, b) => a + b, 0)}, rate ${fit.ratePer1000.toFixed(3)} per 1000 views`);
    expect(fit.ratePer1000).toBeGreaterThan(0.26);
    expect(fit.ratePer1000).toBeLessThan(0.73);
  });
});
