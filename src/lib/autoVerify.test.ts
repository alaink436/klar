import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const bios: Record<string, string> = {};
vi.mock("./contentWarmup", () => ({ readTiktokProfile: async (h: string) => ({ ok: h in bios, bio: bios[h] ?? "", followers: 37 }) }));
vi.mock("./creators", () => ({ addCreator: async () => ({ ok: true, msg: "" }) }));
const mails: Array<[string, string, string]> = [];
vi.mock("./creatorMail", () => ({ sendConfirmedMail: async (...a: [string, string, string]) => void mails.push(a) }));

import { checkWaitingBios } from "./autoVerify";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const waiting = (id: string, handle: string, code: string) => ({
  id,
  user_id: "u",
  email: `${handle}@gmail.com`,
  app_slug: "basalt",
  tiktok_handle: handle,
  country: "US",
  platforms: ["tiktok"],
  has_link: false,
  bio_code: code,
  verified_at: null,
  created_at: "2026-10-22T05:00:00Z",
  estimate_accepted_at: "2026-10-22T05:00:00Z",
  strikes: 0,
  suspended_until: null,
  closed_at: null,
  followers: null,
});

describe("checkWaitingBios", () => {
  const urls: string[] = [];
  const patches: Array<{ url: string; body: unknown }> = [];
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    urls.length = 0;
    patches.length = 0;
    mails.length = 0;
    for (const k of Object.keys(bios)) delete bios[k];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        urls.push(url);
        if (init?.method === "PATCH") patches.push({ url, body: JSON.parse(String(init.body)) });
        if (init?.method) return new Response(null, { status: 204 });
        if (url.includes("verified_at=is.null&tiktok_handle=not.is.null")) {
          return new Response(JSON.stringify([waiting("a1", "babysphinx8", "klar-ZCFZ"), waiting("a2", "notyet", "klar-AAAA")]));
        }
        return new Response("[]"); // nobody else verified these handles
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("confirms whoever has the code in the bio, mails them, and leaves the rest waiting", async () => {
    bios.babysphinx8 = "klar-ZCFZ";
    bios.notyet = "just vibes";
    expect(await checkWaitingBios(NOW)).toEqual({ checked: 2, confirmed: ["babysphinx8"] });
    expect(patches).toHaveLength(1);
    expect(patches[0].url).toContain("id=eq.a1&verified_at=is.null");
    expect(patches[0].body).toMatchObject({ followers: 37 });
    expect(mails).toEqual([["babysphinx8@gmail.com", "babysphinx8", "klar-ZCFZ"]]);
  });

  it("asks only for accounts connected in the last 7 days, without test accounts, at most 10", async () => {
    await checkWaitingBios(NOW);
    const list = urls.find((u) => u.includes("verified_at=is.null&tiktok_handle=not.is.null"))!;
    expect(list).toContain("estimate_accepted_at=gte.2026-10-16T12:00:00.000Z");
    expect(list).toContain("email=not.like.klar_test*");
    expect(list).toContain("closed_at=is.null");
    expect(list).toContain("limit=10");
  });
});
