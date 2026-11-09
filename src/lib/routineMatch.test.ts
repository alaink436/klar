import { describe, expect, it } from "vitest";
import { hashtagKey, matchPosts, viewsAt, type RoutinePostRef, type TikTokPostRef } from "./routineMatch";

const LDR = "#longdistancerelationship #ldr #longdistance #couples #pocketmate";

function r(id: string, scheduledFor: string, caption: string, postId: string | null = null, handle = "mylooame00l"): RoutinePostRef {
  return { id, handle, caption, scheduledFor, postId };
}
function t(postId: string, postedAt: string, caption: string, handle = "mylooame00l"): TikTokPostRef {
  return { postId, handle, caption, postedAt };
}

describe("hashtagKey", () => {
  it("ignores the hook, order and case", () => {
    expect(hashtagKey("6,000 km and he still says this #LDR #pocketmate #ldr")).toBe("#ldr #pocketmate");
    expect(hashtagKey("no tags here")).toBe("");
  });
});

describe("matchPosts", () => {
  it("links by hashtags and keeps two identical tag lines in posting order", () => {
    const links = matchPosts(
      [r("b", "2026-11-10T17:00:00Z", `hilfe ${LDR}`), r("a", "2026-11-10T12:00:00Z", `pointe ${LDR}`)],
      [t("2", "2026-11-10T17:40:00Z", LDR), t("1", "2026-11-10T12:20:00Z", LDR)],
    );
    expect(links).toEqual([
      { id: "a", postId: "1" },
      { id: "b", postId: "2" },
    ]);
  });

  it("does not match other hashtags, other accounts, or posts long before the slot", () => {
    const links = matchPosts(
      [r("a", "2026-11-10T12:00:00Z", "x #fitness #basalt", null, "basaltapp_de")],
      [
        t("1", "2026-11-10T12:10:00Z", "#sleep #basalt", "basaltapp_de"),
        t("2", "2026-11-10T12:10:00Z", "#fitness #basalt", "motivationwithbasalt"),
        t("3", "2026-11-10T09:00:00Z", "#fitness #basalt", "basaltapp_de"),
      ],
    );
    expect(links).toEqual([]);
  });

  it("leaves existing links alone and never hands a TikTok post out twice", () => {
    const links = matchPosts(
      [r("a", "2026-11-10T12:00:00Z", LDR, "1"), r("b", "2026-11-10T12:00:00Z", LDR)],
      [t("1", "2026-11-10T12:05:00Z", LDR)],
    );
    expect(links).toEqual([]);
  });
});

describe("viewsAt", () => {
  const snaps = [
    { fetchedAt: "2026-11-10T18:00:00Z", views: 100 },
    { fetchedAt: "2026-11-11T06:00:00Z", views: 900 },
    { fetchedAt: "2026-11-11T18:00:00Z", views: 1500 },
  ];
  it("takes the last snapshot before the age is reached", () => {
    expect(viewsAt(snaps, "2026-11-10T12:00:00Z", 86_400_000, Date.parse("2026-11-12T00:00:00Z"))).toBe(900);
  });
  it("is null while the post is younger than the age", () => {
    expect(viewsAt(snaps, "2026-11-10T12:00:00Z", 3 * 86_400_000, Date.parse("2026-11-12T00:00:00Z"))).toBeNull();
  });
});
