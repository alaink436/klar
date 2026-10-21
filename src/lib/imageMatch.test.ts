// The test set ticket 04 asks for before going live: every edit that broke the
// plain fingerprint on 2026-10-21 must still find the right slide, and a slide we
// never handed out must not match. Fixtures are three of our rendered slides and
// one other Basalt slide, downscaled.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MATCH_INLIERS, bestMatch, features, type Features } from "./imageMatch";

const dir = join(__dirname, "__fixtures__", "slides");
const load = (f: string) => readFileSync(join(dir, f));
const OURS = ["ours-cover.jpg", "ours-habit.jpg", "ours-deep.jpg"];

type Edit = (img: sharp.Sharp, w: number, h: number) => sharp.Sharp;
const bar = (w: number, h: number, share: number) =>
  ({ input: { create: { width: w, height: Math.round(h * share), channels: 3, background: "#ffffff" } }, top: Math.round(h * 0.42), left: 0 }) as const;
const crop = (w: number, h: number, share: number) => ({
  left: Math.round(w * share),
  top: Math.round(h * share),
  width: Math.round(w * (1 - 2 * share)),
  height: Math.round(h * (1 - 2 * share)),
});
const EDITS: Record<string, Edit> = {
  "TikTok compression": (img) => img.jpeg({ quality: 70 }),
  "heavy compression": (img) => img.jpeg({ quality: 35 }),
  "15 % brighter": (img) => img.modulate({ brightness: 1.15 }),
  "filter (less saturation, soft)": (img) => img.modulate({ saturation: 0.6 }).blur(1),
  "3 % cropped": (img, w, h) => img.extract(crop(w, h, 0.03)),
  "8 % cropped": (img, w, h) => img.extract(crop(w, h, 0.08)),
  "text bar over 8 %": (img, w, h) => img.composite([bar(w, h, 0.08)]),
  "text bar over 20 %": (img, w, h) => img.composite([bar(w, h, 0.2)]),
  "screenshot with status bar": (img, w, h) => img.extend({ top: Math.round(h * 0.06), background: "#000000" }),
};

describe("bestMatch", () => {
  let refs: Array<{ key: string; f: Features }>;
  beforeAll(async () => {
    refs = await Promise.all(OURS.map(async (key) => ({ key, f: await features(load(key)) })));
  }, 60_000);

  for (const [name, edit] of Object.entries(EDITS)) {
    it(`finds the right slide after: ${name}`, async () => {
      for (const key of OURS) {
        const src = sharp(load(key));
        const { width = 0, height = 0 } = await src.metadata();
        const edited = await edit(src, width, height).jpeg({ quality: 85 }).toBuffer();
        const f = await features(edited);
        const best = await bestMatch(f, refs);
        f.free();
        expect(best.key, `${key} after ${name}`).toBe(key);
        expect(best.points, `${key} after ${name}`).toBeGreaterThanOrEqual(MATCH_INLIERS);
      }
    }, 60_000);
  }

  it("does not match a slide we never handed out", async () => {
    const f = await features(load("foreign.jpg"));
    const best = await bestMatch(f, refs);
    f.free();
    expect(best.points).toBeLessThan(MATCH_INLIERS);
  }, 60_000);
});
