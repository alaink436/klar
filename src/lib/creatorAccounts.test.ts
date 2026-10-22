import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const profile = { ok: true, bio: "", followers: 120 as number | null };
vi.mock("./contentWarmup", () => ({ readTiktokProfile: async () => profile }));
const addCreator = vi.fn(async () => ({ ok: true, msg: "" }));
vi.mock("./creators", () => ({ addCreator: (...a: unknown[]) => addCreator(...(a as [])) }));

import {
  accountStatus,
  bioHasCode,
  connectTiktok,
  disconnectTiktok,
  ensureCreatorAccount,
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
  const open = { tiktok_handle: "lisa", verified_at: null, suspended_until: null, closed_at: null };
  it("is unconnected without a TikTok, then waits for the bio code until verified", () => {
    expect(accountStatus({ ...open, tiktok_handle: null }, now)).toBe("unconnected");
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

const ACCOUNT_NEW: CreatorAccount = {
  id: "c1",
  user_id: "u1",
  email: "lisa@example.com",
  app_slug: "basalt",
  tiktok_handle: null,
  country: null,
  platforms: ["tiktok"],
  has_link: false,
  bio_code: "klar-7F3K",
  verified_at: null,
  created_at: "2026-10-22T08:00:00Z",
  strikes: 0,
  suspended_until: null,
  closed_at: null,
  followers: null,
};

describe("ensureCreatorAccount", () => {
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

  it("creates the account at the first login, for Basalt, with a bio code and no TikTok yet", async () => {
    const r = await ensureCreatorAccount("u1", "lisa@example.com");
    expect(r?.created).toBe(true);
    expect(writes[0].url).toContain("on_conflict=user_id");
    expect(writes[0].body).toMatchObject({ user_id: "u1", email: "lisa@example.com", app_slug: "basalt" });
    expect((writes[0].body as { bio_code: string }).bio_code).toMatch(/^klar-/);
    expect(writes[0].body).not.toHaveProperty("tiktok_handle");
  });

  it("keeps the account that is already there", async () => {
    hub.creators = [ACCOUNT_NEW];
    expect(await ensureCreatorAccount("u1", "lisa@example.com")).toEqual({ account: ACCOUNT_NEW, created: false });
    expect(writes).toEqual([]);
  });
});

describe("connectTiktok", () => {
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

  it("takes only the username, the country from the IP and the consent with the button", async () => {
    expect(await connectTiktok(ACCOUNT_NEW, { handle: "@Lisa", country: "de" })).toEqual({ ok: true });
    expect(writes[0].method).toBe("PATCH");
    expect(writes[0].url).toContain("id=eq.c1&verified_at=is.null");
    expect(writes[0].body).toMatchObject({ tiktok_handle: "lisa", country: "DE" });
    expect((writes[0].body as { estimate_accepted_at: string }).estimate_accepted_at).toBeTruthy();
  });

  it("leaves the country empty without the IP header", async () => {
    await connectTiktok(ACCOUNT_NEW, { handle: "lisa", country: null });
    expect(writes[0].body).toMatchObject({ country: null });
  });

  it("refuses a bad username, a verified account, and a handle someone else verified or one of ours", async () => {
    expect(await connectTiktok(ACCOUNT_NEW, { handle: "no spaces allowed" })).toEqual({ ok: false, error: "bad_handle" });
    expect(await connectTiktok({ ...ACCOUNT_NEW, tiktok_handle: "lisa", verified_at: "2026-10-22T09:00:00Z" }, { handle: "lisa2" })).toEqual({ ok: false, error: "exists" });
    hub.verified = [{ id: "other" }];
    expect(await connectTiktok(ACCOUNT_NEW, { handle: "lisa" })).toEqual({ ok: false, error: "handle_taken" });
    hub.verified = [];
    hub.own = [{ id: "own" }];
    expect(await connectTiktok(ACCOUNT_NEW, { handle: "lisa" })).toEqual({ ok: false, error: "handle_taken" });
    expect(writes).toEqual([]);
  });

  it("lets go of an unverified username, never of a verified one", async () => {
    expect(await disconnectTiktok({ ...ACCOUNT_NEW, tiktok_handle: "lsia" })).toBe(true);
    expect(writes[0].body).toEqual({ tiktok_handle: null });
    expect(await disconnectTiktok({ ...ACCOUNT_NEW, tiktok_handle: "lisa", verified_at: "2026-10-22T09:00:00Z" })).toBe(false);
    expect(writes).toHaveLength(1);
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
    profile.followers = 120;
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
    expect(writes[0].body).toMatchObject({ followers: 120 });
    expect(writes[1].body).toEqual({ platform: "tiktok", handle: "lisa", app_slug: "basalt", source: "creator" });
    expect(addCreator).not.toHaveBeenCalled();
  });

  it("keeps the followers it had when TikTok doesn't show them", async () => {
    profile.bio = "klar-7F3K";
    profile.followers = null;
    await verifyCreatorAccount(account);
    expect(writes[0].body).not.toHaveProperty("followers");
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
