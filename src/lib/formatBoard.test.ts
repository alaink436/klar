import { describe, expect, it } from "vitest";
import { hookOf, rankPosts, summarizeFormats, tagsOf, type BoardPost } from "./formatBoard";

function p(name: string, format: string, views24h: number | null, app = "pocketmate", scheduledFor = "2026-11-10T12:00:00Z"): BoardPost {
  return {
    app_slug: app,
    handle: "mylooame00l",
    name,
    format,
    caption: `${name} hook #ldr #pocketmate`,
    scheduledFor,
    url: null,
    views24h,
    views3d: null,
    viewsNow: views24h,
    planned: false,
  };
}

describe("hookOf and tagsOf", () => {
  it("split a caption into hook and hashtags", () => {
    expect(hookOf("6,000 km and he still says this #ldr #pocketmate")).toBe("6,000 km and he still says this");
    expect(tagsOf("6,000 km #ldr #pocketmate")).toEqual(["#ldr", "#pocketmate"]);
  });
});

describe("summarizeFormats", () => {
  it("ranks formats by mean views at 24 hours, uncounted posts listed but not averaged", () => {
    const rows = summarizeFormats([p("chat-01", "chat", 3000), p("chat-02", "chat", 1000), p("liste-01", "liste", 900), p("liste-02", "liste", null), p("worst-01", "worst", null)]);
    expect(rows.map((r) => [r.format, r.posts, r.read, r.avg24h])).toEqual([
      ["chat", 2, 2, 2000],
      ["liste", 2, 1, 900],
      ["worst", 1, 0, null],
    ]);
    expect(rows[0].best).toEqual({ name: "chat-01", views24h: 3000 });
  });

  it("keeps the same format name of two apps apart", () => {
    const rows = summarizeFormats([p("liste-01", "liste", 100), p("bestyou-01", "liste", 500, "kelva")]);
    expect(rows.map((r) => r.app_slug)).toEqual(["kelva", "pocketmate"]);
  });
});

describe("rankPosts", () => {
  it("puts counted posts first by views, the rest newest first", () => {
    const ranked = rankPosts([
      p("a", "chat", null, "pocketmate", "2026-11-09T12:00:00Z"),
      p("b", "chat", 50),
      p("c", "chat", null, "pocketmate", "2026-11-11T12:00:00Z"),
      p("d", "chat", 900),
    ]);
    expect(ranked.map((x) => x.name)).toEqual(["d", "b", "c", "a"]);
  });
});
