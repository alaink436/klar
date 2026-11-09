import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./vault", () => ({ getForProxy: async () => null }));

import { parseCount, parseProfileGrid } from "./ownViews";

const AT = "2026-11-09T19:00:00.000Z";

// The shape of a post in the grid of a rendered profile, as Evomi returned it on 2026-11-09 (trimmed).
function item(handle: string, id: string, views: string, alt: string) {
  return (
    `<div data-e2e="user-post-item" role="button"><a href="https://www.tiktok.com/@${handle}/photo/${id}">` +
    `<img alt="${alt}" src="x"><strong data-e2e="video-views" class="video-count">${views}</strong></a></div>`
  );
}

describe("parseCount", () => {
  it("reads TikTok's short counts", () => {
    expect(parseCount("1095")).toBe(1095);
    expect(parseCount("12.1K")).toBe(12100);
    expect(parseCount("1.2M")).toBe(1200000);
    expect(parseCount("views")).toBeNull();
  });
});

describe("parseProfileGrid", () => {
  it("takes id, time from the id, views and the caption from the cover's alt text", () => {
    const html =
      item("motivationwithbasalt", "7706230747710917910", "1095", "#fitness #running #workout #tierlist #basalt created by basalt-follow through with bbbogdan &amp; ABCMUSIC’s WHO DO U KNOW") +
      item("motivationwithbasalt", "7706140579083635990", "12.1K", "#guthealth #basalt created by basalt-follow through with a sound");
    const { posts, views } = parseProfileGrid(html, "MotivationWithBasalt", AT);
    expect(posts[0]).toEqual({
      post_id: "7706230747710917910",
      platform: "tiktok",
      handle: "motivationwithbasalt",
      posted_at: "2026-11-09T17:51:05.000Z", // id >> 32; Apify said 17:51:10 for the same post
      url: "https://www.tiktok.com/@motivationwithbasalt/photo/7706230747710917910",
      is_slideshow: true,
      caption: "#fitness #running #workout #tierlist #basalt",
    });
    expect(views.map((v) => v.views)).toEqual([1095, 12100]);
    expect(views[0]).toMatchObject({ fetched_at: AT, likes: null });
  });

  it("leaves out reposts of other accounts and duplicates", () => {
    const html =
      item("someoneelse", "7706230747710917911", "500", "x") +
      item("bris_selfcare", "7706230747710917912", "800", "#kelva created by bri") +
      item("bris_selfcare", "7706230747710917912", "800", "#kelva created by bri");
    expect(parseProfileGrid(html, "bris_selfcare", AT).posts.map((p) => p.post_id)).toEqual(["7706230747710917912"]);
  });
});
