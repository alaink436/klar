import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creatorRedirect, linkDevice } from "./creators";

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

describe("linkDevice", () => {
  it("reads the user agent", () => {
    expect(linkDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(linkDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android");
    expect(linkDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});
