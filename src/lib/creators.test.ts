import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creatorRedirect, fetchCreators, linkDevice } from "./creators";

// The hub answers two questions: which app owns the short path, and is the
// handle a live creator of it. Both are faked here per test.
function fakeHub(app: { slug: string; detour_link: string | null; store_url: string | null } | null, creator: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("klar_creator_apps")) return new Response(JSON.stringify(app ? [app] : []));
      return new Response(JSON.stringify(creator ? [{ handle: "tonystark" }] : []));
    }),
  );
}

const STORE = "https://apps.apple.com/app/id1";
const DETOUR = "https://klar.godetour.link/abc";

describe("creatorRedirect", () => {
  beforeEach(() => vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends phones through Detour and computers to the app page", async () => {
    fakeHub({ slug: "basalt", detour_link: DETOUR, store_url: STORE }, true);
    expect(await creatorRedirect("basalt", "TonyStark", "ios")).toBe(`${DETOUR}?ref=tonystark`);
    expect(await creatorRedirect("basalt", "tonystark", "android")).toBe(`${DETOUR}?ref=tonystark`);
    expect(await creatorRedirect("basalt", "tonystark", "desktop")).toBe("https://getklar.org/basalt?ref=tonystark");
  });

  it("without Detour: iPhone to the store, Android and computer to the app page", async () => {
    fakeHub({ slug: "anime-vault", detour_link: null, store_url: STORE }, true);
    expect(await creatorRedirect("animevault", "tonystark", "ios")).toBe(STORE);
    expect(await creatorRedirect("animevault", "tonystark", "android")).toBe("https://getklar.org/animevault?ref=tonystark");
    expect(await creatorRedirect("animevault", "tonystark", "desktop")).toBe("https://getklar.org/animevault?ref=tonystark");
  });

  it("an unknown creator gets the page or the store, without ref", async () => {
    fakeHub({ slug: "basalt", detour_link: DETOUR, store_url: STORE }, false);
    expect(await creatorRedirect("basalt", "nobody", "ios")).toBe(STORE);
    expect(await creatorRedirect("basalt", "nobody", "desktop")).toBe("https://getklar.org/basalt");
  });

  it("an app without a page keeps the store, and an unknown short path is a 404", async () => {
    fakeHub({ slug: "learnbound", detour_link: null, store_url: null }, true);
    expect(await creatorRedirect("learn", "tonystark", "desktop")).toBe("https://getklar.org/");
    fakeHub(null, false);
    expect(await creatorRedirect("nope", "tonystark", "desktop")).toBeNull();
  });
});

describe("fetchCreators", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // Kelva keeps Pro in `is_premium`, Basalt in `is_pro`; asking Kelva for
  // `is_pro` is a 400 and the whole user list loses its names.
  it("reads Pro from the column each app keeps it in", async () => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    vi.stubEnv(
      "KLAR_ADMIN_APPS",
      JSON.stringify([
        { slug: "kelva", name: "Kelva", supabaseUrl: "https://kelva.test", serviceKey: "k" },
        { slug: "wavelength", name: "Basalt", supabaseUrl: "https://basalt.test", serviceKey: "b" },
      ]),
    );
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        asked.push(url);
        const json = (body: unknown) => new Response(JSON.stringify(body));
        if (url.includes("klar_creator_apps"))
          return json([
            { slug: "kelva", name: "Kelva", short_path: "kelva", detour_link: DETOUR, store_url: STORE, backend_slug: "kelva" },
            { slug: "basalt", name: "Basalt", short_path: "basalt", detour_link: DETOUR, store_url: STORE, backend_slug: "wavelength" },
          ]);
        if (url.includes("klar_creator_links"))
          return json([
            { app_slug: "kelva", handle: "mia", name: "Mia" },
            { app_slug: "basalt", handle: "tonystark", name: "Tony Stark" },
          ]);
        if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "0-0/1" } });
        if (url.includes("/referrals"))
          return json([{ user_id: url.includes("kelva") ? "u1" : "u2", influencer_handle: url.includes("kelva") ? "mia" : "tonystark", created_at: "2026-10-16T10:00:00Z" }]);
        if (url.startsWith("https://kelva.test") && url.includes("pro:is_premium"))
          return json([{ id: "u1", display_name: "Anna", pro: true }]);
        if (url.startsWith("https://basalt.test") && url.includes("pro:is_pro"))
          return json([{ id: "u2", display_name: "Ben", pro: false }]);
        return new Response("column does not exist", { status: 400 });
      }),
    );

    const r = await fetchCreators();
    expect(r.errors).toEqual([]);
    expect(r.users.map((u) => [u.app, u.name, u.pro]).sort()).toEqual([
      ["Basalt", "Ben", false],
      ["Kelva", "Anna", true],
    ]);
    expect(r.creators.find((c) => c.handle === "mia")?.referrals).toBe(1);
  });

  // Learnbound keeps profiles in `study` keyed by `user_id`, and Pro in
  // `study.entitlements`; `public.profiles` does not exist there.
  it("reads Learnbound's profiles and Pro from the study schema", async () => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    vi.stubEnv(
      "KLAR_ADMIN_APPS",
      JSON.stringify([{ slug: "learnbound", name: "Learnbound", supabaseUrl: "https://learnbound.test", serviceKey: "l" }]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const json = (body: unknown) => new Response(JSON.stringify(body));
        const profile = (init?.headers as Record<string, string> | undefined)?.["Accept-Profile"];
        if (url.includes("klar_creator_apps"))
          return json([{ slug: "learnbound", name: "Learnbound", short_path: "learn", detour_link: DETOUR, store_url: null, backend_slug: "learnbound" }]);
        if (url.includes("klar_creator_links")) return json([{ app_slug: "learnbound", handle: "mia", name: "Mia" }]);
        if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "0-1/2" } });
        if (url.includes("/referrals"))
          return json([
            { user_id: "u1", influencer_handle: "mia", created_at: "2026-10-21T10:00:00Z" },
            { user_id: "u2", influencer_handle: "mia", created_at: "2026-10-21T11:00:00Z" },
          ]);
        if (profile === "study" && url.includes("/profiles?select=id:user_id,display_name"))
          return json([{ id: "u1", display_name: "Anna" }, { id: "u2", display_name: "Ben" }]);
        if (profile === "study" && url.includes("/entitlements") && url.includes("is_pro=is.true")) return json([{ user_id: "u1" }]);
        return new Response("relation does not exist", { status: 404 });
      }),
    );

    const r = await fetchCreators();
    expect(r.errors).toEqual([]);
    expect(r.users.map((u) => [u.name, u.pro])).toEqual([
      ["Ben", false],
      ["Anna", true],
    ]);
    expect(r.creators[0]?.referrals).toBe(2);
  });
});

describe("linkDevice", () => {
  it("reads the user agent", () => {
    expect(linkDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(linkDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android");
    expect(linkDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});
