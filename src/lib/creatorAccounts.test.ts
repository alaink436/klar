import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const profile = { ok: true, bio: "", followers: 120 as number | null };
vi.mock("./contentWarmup", () => ({ readTiktokProfile: async () => profile }));
const addCreator = vi.fn(async () => ({ ok: true, msg: "" }));
vi.mock("./creators", () => ({ addCreator: (...a: unknown[]) => addCreator(...(a as [])) }));

import {
  accountStatus,
  bioHasCode,
  createCreatorAccount,
  unfinishedSignups,
  newBioCode,
  normaliseHandle,
  verifyCreatorAccount,
  type CreatorAccount,
} from "./creatorAccounts";

describe("normaliseHandle", () => {
  it("takes @name, name and profile links", () => {
    expect(normaliseHandle("@Lisa.Fit_")).toBe("lisa.fit_");
    expect(normaliseHandle(" lisa ")).toBe("lisa");
    expect(normaliseHandle("https://www.tiktok.com/@lisa?lang=en")).toBe("lisa");
  });
  it("refuses what TikTok would not allow", () => {
    expect(normaliseHandle("a")).toBeNull();
    expect(normaliseHandle("lisa fit")).toBeNull();
    expect(normaliseHandle("x".repeat(25))).toBeNull();
  });
});

describe("accountStatus", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const open = { verified_at: null, suspended_until: null, closed_at: null };
  it("waits for the bio code until the account is verified", () => {
    expect(accountStatus(open, now)).toBe("waiting");
    expect(accountStatus({ ...open, verified_at: "2026-10-22T08:00:00Z" }, now)).toBe("verified");
  });
  it("is paused only while the pause lasts, closed for good", () => {
    const verified = { ...open, verified_at: "2026-10-20T08:00:00Z" };
    expect(accountStatus({ ...verified, suspended_until: "2026-10-23T00:00:00Z" }, now)).toBe("paused");
    expect(accountStatus({ ...verified, suspended_until: "2026-10-21T00:00:00Z" }, now)).toBe("verified");
    expect(accountStatus({ ...verified, closed_at: "2026-10-21T00:00:00Z" }, now)).toBe("closed");
  });
});

describe("unfinishedSignups", () => {
  it("lists dashboard logins without an account, newest first, not the affiliate era's", () => {
    const users = [
      { id: "u1", email: "pete@gmail.com", last_sign_in_at: "2026-10-22T05:13:01Z" },
      { id: "u2", email: "dra@gmail.com", last_sign_in_at: "2026-10-21T23:25:51Z" },
      { id: "u3", email: "old@gmail.com", last_sign_in_at: "2026-07-10T02:04:38Z" },
      { id: "u4", email: "never@gmail.com", last_sign_in_at: null },
      { id: "u5", email: "late@gmail.com", last_sign_in_at: "2026-10-22T09:00:00Z" },
    ];
    expect(unfinishedSignups(users, new Set(["u1"]))).toEqual([
      { userId: "u5", email: "late@gmail.com", signedInAt: "2026-10-22T09:00:00Z" },
      { userId: "u2", email: "dra@gmail.com", signedInAt: "2026-10-21T23:25:51Z" },
    ]);
  });
});

describe("bio code", () => {
  it("looks like klar-XXXX without look-alike characters", () => {
    for (let i = 0; i < 50; i++) expect(newBioCode()).toMatch(/^klar-[A-HJKMNP-Z2-9]{4}$/);
  });
  it("is found in the bio whatever the case", () => {
    expect(bioHasCode("gym girl 💪 KLAR-7F3K", "klar-7F3K")).toBe(true);
    expect(bioHasCode("gym girl", "klar-7F3K")).toBe(false);
  });
});

// The hub answers by table; writes are recorded per table.
let hub: { creators: unknown[]; verified: unknown[]; own: unknown[]; patchStatus: number };
const writes: Array<{ method: string; url: string; body: unknown }> = [];
function fakeHub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") {
        writes.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : null });
        if (method === "PATCH") return new Response(null, { status: hub.patchStatus });
        if (url.includes("klar_creator_accounts")) return new Response(JSON.stringify([{ id: "new", ...JSON.parse(String(init?.body)) }]), { status: 201 });
        return new Response(null, { status: 201 });
      }
      if (url.includes("klar_view_accounts")) return new Response(JSON.stringify(hub.own));
      if (url.includes("verified_at=not.is.null")) return new Response(JSON.stringify(hub.verified));
      return new Response(JSON.stringify(hub.creators));
    }),
  );
}

const SIGNUP = {
  userId: "u1",
  email: "lisa@example.com",
  handle: "@Lisa",
  country: "de",
  platforms: ["tiktok", "instagram"],
  hasLink: false,
  acceptedEstimate: true,
};

describe("createCreatorAccount", () => {
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    hub = { creators: [], verified: [], own: [], patchStatus: 204 };
    writes.length = 0;
    fakeHub();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stores the account for Basalt with a bio code", async () => {
    const r = await createCreatorAccount(SIGNUP);
    expect(r.ok).toBe(true);
    expect(writes[0].body).toMatchObject({ app_slug: "basalt", tiktok_handle: "lisa", country: "DE", platforms: ["tiktok", "instagram"] });
    expect((writes[0].body as { bio_code: string }).bio_code).toMatch(/^klar-/);
  });

  it("refuses without the tick, without TikTok, or for an unknown platform", async () => {
    expect(await createCreatorAccount({ ...SIGNUP, acceptedEstimate: false })).toEqual({ ok: false, error: "no_consent" });
    expect(await createCreatorAccount({ ...SIGNUP, platforms: ["instagram"] })).toEqual({ ok: false, error: "bad_platforms" });
    expect(await createCreatorAccount({ ...SIGNUP, platforms: ["tiktok", "snapchat"] })).toEqual({ ok: false, error: "bad_platforms" });
    expect(writes).toEqual([]);
  });

  it("refuses a handle that is verified for someone else or one of our own accounts", async () => {
    hub.verified = [{ id: "other" }];
    expect(await createCreatorAccount(SIGNUP)).toEqual({ ok: false, error: "handle_taken" });
    hub.verified = [];
    hub.own = [{ id: "own" }];
    expect(await createCreatorAccount(SIGNUP)).toEqual({ ok: false, error: "handle_taken" });
    expect(writes).toEqual([]);
  });
});

describe("verifyCreatorAccount", () => {
  const account: CreatorAccount = {
    id: "c1",
    user_id: "u1",
    email: "lisa@example.com",
    app_slug: "basalt",
    tiktok_handle: "lisa",
    country: "DE",
    platforms: ["tiktok"],
    has_link: false,
    bio_code: "klar-7F3K",
    verified_at: null,
    created_at: "2026-10-21T12:00:00Z",
    strikes: 0,
    suspended_until: null,
    closed_at: null,
    followers: null,
  };

  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    hub = { creators: [], verified: [], own: [], patchStatus: 204 };
    writes.length = 0;
    addCreator.mockClear();
    profile.ok = true;
    profile.bio = "";
    fakeHub();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("writes nothing while the code is not in the bio", async () => {
    profile.bio = "gym girl";
    expect(await verifyCreatorAccount(account)).toEqual({ ok: false, error: "code_missing" });
    expect(writes).toEqual([]);
  });

  it("writes nothing when the profile cannot be read", async () => {
    profile.ok = false;
    expect(await verifyCreatorAccount(account)).toEqual({ ok: false, error: "profile_unreadable" });
    expect(writes).toEqual([]);
  });

  it("verifies and has the account read as a creator's", async () => {
    profile.bio = "gym girl klar-7f3k";
    expect(await verifyCreatorAccount(account)).toEqual({ ok: true });
    expect(writes.map((w) => w.method)).toEqual(["PATCH", "POST"]);
    expect(writes[1].body).toEqual({ platform: "tiktok", handle: "lisa", app_slug: "basalt", source: "creator" });
    expect(addCreator).not.toHaveBeenCalled();
  });

  it("gives a creator with a link his short link", async () => {
    profile.bio = "klar-7F3K";
    await verifyCreatorAccount({ ...account, has_link: true });
    expect(addCreator).toHaveBeenCalledWith("basalt", "lisa", "lisa");
  });

  it("loses the race to someone who verified the same handle first", async () => {
    profile.bio = "klar-7F3K";
    hub.patchStatus = 409;
    expect(await verifyCreatorAccount(account)).toEqual({ ok: false, error: "handle_taken" });
  });
});
