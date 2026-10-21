import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./vault", () => ({
  listSecrets: async () => [{ id: "k1", provider: "apify", label: "Apify Key", revoked_at: null }],
  revealSecret: async () => "apify-key",
}));

import { APIFY_TASK_ID, ingestRun, parseItems } from "./postViews";

const AT = "2026-10-21T12:00:00.000Z";

function item(over: Record<string, unknown> = {}) {
  return {
    id: "7698852867943255318",
    createTime: 1792528876,
    playCount: 954,
    diggCount: 53,
    commentCount: 2,
    shareCount: 1,
    collectCount: 9,
    authorMeta: { name: "MotivationWithBasalt" },
    webVideoUrl: "https://www.tiktok.com/@motivationwithbasalt/photo/7698852867943255318",
    isSlideshow: true,
    ...over,
  };
}

describe("parseItems", () => {
  it("turns a scraper item into a post and a view row", () => {
    const { posts, views } = parseItems([item()], AT);
    expect(posts).toEqual([
      {
        post_id: "7698852867943255318",
        platform: "tiktok",
        handle: "motivationwithbasalt",
        posted_at: "2026-10-20T20:41:16.000Z",
        url: "https://www.tiktok.com/@motivationwithbasalt/photo/7698852867943255318",
        is_slideshow: true,
      },
    ]);
    expect(views).toEqual([
      { post_id: "7698852867943255318", fetched_at: AT, views: 954, likes: 53, comments: 2, shares: 1, saves: 9 },
    ]);
  });

  it("drops error items and duplicates", () => {
    const err = { error: "Profile not found", input: "nobody" };
    const { posts } = parseItems([item(), err, item(), item({ id: "2", playCount: undefined })], AT);
    expect(posts.map((p) => p.post_id)).toEqual(["7698852867943255318"]);
  });
});

describe("ingestRun", () => {
  const inserted: Record<string, unknown[]> = {};
  let run: Record<string, unknown>;

  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "hub");
    run = { actorTaskId: APIFY_TASK_ID, status: "SUCCEEDED", finishedAt: AT, defaultDatasetId: "ds1" };
    for (const k of Object.keys(inserted)) delete inserted[k];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/actor-runs/")) return new Response(JSON.stringify({ data: run }));
        if (url.includes("/datasets/ds1/items")) return new Response(JSON.stringify([item()]));
        if (url.includes("klar_view_accounts")) return new Response(JSON.stringify([{ handle: "motivationwithbasalt" }]));
        if (url.includes("/actor-tasks/")) return new Response("{}");
        const table = url.split("/rest/v1/")[1];
        inserted[table] = JSON.parse(String(init?.body));
        return new Response(null, { status: 201 });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stores a succeeded run of our task", async () => {
    const r = await ingestRun("abcdefghij12");
    expect(r).toEqual({ ok: true, runId: "abcdefghij12", fetchedAt: AT, posts: 1, accounts: 1 });
    expect(inserted.klar_posts).toHaveLength(1);
    expect(inserted.klar_post_views).toEqual([expect.objectContaining({ views: 954, fetched_at: AT })]);
  });

  it("refuses a run of another task without storing anything", async () => {
    run.actorTaskId = "someoneElse";
    expect(await ingestRun("abcdefghij12")).toEqual({ ok: false, error: "foreign-run", retry: false });
    expect(inserted).toEqual({});
  });

  it("refuses a run that did not succeed", async () => {
    run.status = "RUNNING";
    expect(await ingestRun("abcdefghij12")).toEqual({ ok: false, error: "run-running", retry: false });
  });
});
