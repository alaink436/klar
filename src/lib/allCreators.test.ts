import { describe, expect, it } from "vitest";
import { mergeCreators } from "./allCreators";
import type { CreatorAccount } from "./creatorAccounts";

const acc = (o: Partial<CreatorAccount> & { id: string; status: "unconnected" | "waiting" | "verified" | "paused" | "closed" }) =>
  ({
    user_id: "u",
    email: `${o.id}@gmail.com`,
    app_slug: "basalt",
    tiktok_handle: null,
    country: "US",
    platforms: ["tiktok"],
    has_link: false,
    bio_code: "klar-AAAA",
    verified_at: null,
    created_at: "2026-10-22T00:00:00Z",
    strikes: 0,
    suspended_until: null,
    closed_at: null,
    followers: null,
    ...o,
  }) as CreatorAccount & { status: "verified" };

describe("mergeCreators", () => {
  it("lists platform creators and hand-added ones once each, without sign-ups lacking a TikTok or test accounts", () => {
    const rows = mergeCreators({
      accounts: [
        acc({ id: "a1", tiktok_handle: "voxlicia", status: "verified", followers: 3119, has_link: true }),
        acc({ id: "a2", tiktok_handle: "babysphinx8", status: "waiting" }),
        acc({ id: "a3", status: "unconnected" }),
        acc({ id: "a4", tiktok_handle: "klar_test_demo", status: "verified", email: "klar_test_creator@getklar.org" }),
      ],
      manual: [
        { appSlug: "basalt", appName: "Basalt", handle: "Voxlicia", name: "Vox", link: null, shortLink: "getklar.org/basalt/voxlicia", referrals: 4 },
        { appSlug: "basalt", appName: "Basalt", handle: "tonystark", name: "Tony", link: null, shortLink: "getklar.org/basalt/tonystark", referrals: 1 },
      ],
      appNames: { basalt: "Basalt" },
      monthCents: new Map([["a1", 1520]]),
      owedCents: new Map([["a1", 3300]]),
    });
    expect(rows.map((r) => [r.handle, r.origin, r.status])).toEqual([
      ["voxlicia", "platform", "verified"],
      ["babysphinx8", "platform", "waiting"],
      ["tonystark", "manual", "manual"],
    ]);
    expect(rows[0]).toMatchObject({ appName: "Basalt", followers: 3119, hasLink: true, shortLink: "getklar.org/basalt/voxlicia", referrals: 4, monthCents: 1520, owedCents: 3300 });
    expect(rows[2]).toMatchObject({ monthCents: null, owedCents: null, referrals: 1 });
  });

  it("puts confirmed creators before waiting ones when they earned the same", () => {
    const rows = mergeCreators({
      accounts: [acc({ id: "b1", tiktok_handle: "aaa", status: "waiting" }), acc({ id: "b2", tiktok_handle: "zzz", status: "verified" })],
      manual: [],
      appNames: {},
      monthCents: new Map(),
      owedCents: new Map(),
    });
    expect(rows.map((r) => r.handle)).toEqual(["zzz", "aaa"]);
  });
});
