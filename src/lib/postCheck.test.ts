import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./vault", () => ({ getForProxy: async () => null }));
vi.mock("./creatorKit", () => ({ signPaths: async () => [] }));
// The matcher answers per image in order: points for "v1".
const points: number[] = [];
vi.mock("./imageMatch", () => ({
  MATCH_INLIERS: 60,
  features: async () => ({ free: () => {} }),
  bestMatch: async () => ({ key: "v1", points: points.shift() ?? 0 }),
}));

import { decide, postedWhilePaused, reviewPost } from "./postCheck";

const creator = {
  id: "c1",
  email: "lisa@example.com",
  tiktok_handle: "lisa",
  has_link: false,
  strikes: 0,
  suspended_until: null as string | null,
  closed_at: null as string | null,
};
const refs = async () => [];
const item = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  text: "how to actually study #basalt",
  playCount: 400,
  createTime: Date.parse("2026-10-21T10:00:00Z") / 1000,
  slideshowImageLinks: [1, 2, 3, 4].map((i) => ({ tiktokLink: `https://cdn.example/${i}.jpg` })),
  ...over,
});

describe("decide", () => {
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    points.length = 0;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ignores a post without Basalt in the caption", async () => {
    expect((await decide(item({ text: "my morning #gym" }), creator, refs)).status).toBe("no_mention");
  });

  it("lets a creator with a link count through the link, without looking at images", async () => {
    expect((await decide(item(), { ...creator, has_link: true }, refs)).status).toBe("link");
  });

  it("counts a post whose images are mostly his version", async () => {
    points.push(200, 150, 10, 90);
    const row = await decide(item(), creator, refs);
    expect(row).toMatchObject({ status: "counts", checked_slides: 4, matched_slides: 3, variant_id: "v1" });
    expect(row.images).toEqual(["p1/1.jpg", "p1/2.jpg", "p1/3.jpg", "p1/4.jpg"]);
  });

  it("does not count own content: not_ours under 1000 views, review above", async () => {
    points.push(10, 20, 5, 0);
    expect((await decide(item(), creator, refs)).status).toBe("not_ours");
    points.push(10, 20, 5, 0);
    expect((await decide(item({ playCount: 5000 }), creator, refs)).status).toBe("review");
  });

  it("does not count a video (no slides to compare)", async () => {
    expect((await decide(item({ slideshowImageLinks: [] }), creator, refs)).status).toBe("not_ours");
  });

  it("does not count what he posted during his pause", async () => {
    const paused = { ...creator, suspended_until: "2026-11-10T00:00:00Z" };
    expect((await decide(item(), paused, refs)).status).toBe("suspended");
  });
});

describe("postedWhilePaused", () => {
  it("covers the 30 days before suspended_until and everything after closing", () => {
    const at = (s: string) => new Date(s);
    expect(postedWhilePaused({ suspended_until: "2026-11-20T00:00:00Z", closed_at: null }, at("2026-10-22T00:00:00Z"))).toBe(true);
    expect(postedWhilePaused({ suspended_until: "2026-11-20T00:00:00Z", closed_at: null }, at("2026-10-20T00:00:00Z"))).toBe(false);
    expect(postedWhilePaused({ suspended_until: "2026-11-20T00:00:00Z", closed_at: null }, at("2026-11-21T00:00:00Z"))).toBe(false);
    expect(postedWhilePaused({ suspended_until: null, closed_at: "2026-10-01T00:00:00Z" }, at("2026-10-02T00:00:00Z"))).toBe(true);
  });
});

describe("reviewPost", () => {
  let strikes: number;
  const patches: Array<{ url: string; body: Record<string, unknown> }> = [];
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    patches.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patches.push({ url, body: JSON.parse(String(init.body)) });
          return new Response(null, { status: 204 });
        }
        if (url.includes("klar_post_checks")) return new Response(JSON.stringify([{ post_id: "p1", creator_id: "c1", status: "review" }]));
        return new Response(JSON.stringify([{ ...creator, strikes }]));
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("approving touches no strike", async () => {
    strikes = 0;
    expect(await reviewPost("p1", "approve")).toEqual({ ok: true, msg: "Zählt." });
    expect(patches.map((p) => p.body)).toEqual([expect.objectContaining({ status: "approved" })]);
  });

  it("first rejection: a warning, nothing else", async () => {
    strikes = 0;
    const r = await reviewPost("p1", "reject", "own_content");
    expect(r.msg).toContain("Verwarnung");
    expect(patches[1].body).toEqual({ strikes: 1 });
  });

  it("second rejection: a 30-day pause", async () => {
    strikes = 1;
    await reviewPost("p1", "reject", "false_claims");
    const until = Date.parse(String(patches[1].body.suspended_until));
    expect(patches[1].body.strikes).toBe(2);
    expect(Math.round((until - Date.now()) / 86_400_000)).toBe(30);
  });

  it("third rejection: closed, and his account is no longer read", async () => {
    strikes = 2;
    await reviewPost("p1", "reject", "own_content");
    expect(patches[1].body).toMatchObject({ strikes: 3, closed_at: expect.any(String) });
    expect(patches[2].url).toContain("klar_view_accounts");
    expect(patches[2].body).toEqual({ active: false });
  });

  it("refuses a rejection without a reason", async () => {
    strikes = 0;
    expect(await reviewPost("p1", "reject")).toEqual({ ok: false, msg: "Grund fehlt." });
  });
});
