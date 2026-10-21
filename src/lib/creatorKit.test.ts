import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCreatorKit, possibleLooks, setFormatActive } from "./creatorKit";

const HUB = "https://exiuwektrqxvycclqfdd.supabase.co";

describe("possibleLooks", () => {
  it("multiplies hooks, tones, orders and query values", () => {
    expect(possibleLooks({ slides: 8, hooks: ["a", "b", "c", "d"], tones: ["#fff", "#eee", "#ddd"], shuffle: [2, 6] })).toBe(4 * 3 * 120);
    expect(possibleLooks({ slides: 6, query: { post: ["a", "b"] }, tones: ["1", "2", "3", "4", "5"] })).toBe(10);
    expect(possibleLooks({ slides: 6 })).toBe(1);
  });
});

describe("setFormatActive", () => {
  let formats: Array<{ id: string; app_slug: string; active: boolean; name: string }>;
  const patches: string[] = [];
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    patches.length = 0;
    formats = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, app_slug: "basalt", active: i < 5, name: id.toUpperCase() }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patches.push(`${url.split("id=eq.")[1]} ${init.body}`);
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify(formats));
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("refuses a sixth active format", async () => {
    expect(await setFormatActive("f", true)).toEqual({ ok: false, msg: "Schon 5 Formate an. Erst eines ausschalten." });
    expect(patches).toEqual([]);
  });

  it("switches one off, and then the sixth on", async () => {
    expect((await setFormatActive("a", false)).ok).toBe(true);
    formats[0].active = false;
    expect((await setFormatActive("f", true)).ok).toBe(true);
    expect(patches).toEqual(['a {"active":false}', 'f {"active":true}']);
  });
});

describe("getCreatorKit", () => {
  beforeEach(() => {
    vi.stubEnv("KLAR_INBOX_SERVICE_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("rpc/klar_assign_variants")) {
          return new Response(JSON.stringify([{ id: "v1", format_id: "study-01", images: ["study-01/4/1.jpg", "study-01/4/2.jpg"], creator_id: "c1" }]));
        }
        if (url.includes("/storage/v1/object/sign/")) {
          const { paths } = JSON.parse(String(init?.body)) as { paths: string[] };
          return new Response(JSON.stringify(paths.map((p) => ({ path: p, signedURL: `/object/sign/creator-kit/${p}?token=t` }))));
        }
        return new Response(
          JSON.stringify([
            { id: "study-01", name: "how to actually study", caption: "#studytok #basalt", active: true },
            { id: "bdisc-01", name: "discipline", caption: "#basalt", active: true },
          ]),
        );
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns his version with signed links and names a format whose pool ran dry", async () => {
    const { kit, waiting } = await getCreatorKit("c1");
    expect(kit).toEqual([
      {
        formatId: "study-01",
        name: "how to actually study",
        caption: "#studytok #basalt",
        slides: [
          {
            view: `${HUB}/storage/v1/object/sign/creator-kit/study-01/4/1.jpg?token=t`,
            download: `${HUB}/storage/v1/object/sign/creator-kit/study-01/4/1.jpg?token=t&download=basalt-study-01-1.jpg`,
          },
          {
            view: `${HUB}/storage/v1/object/sign/creator-kit/study-01/4/2.jpg?token=t`,
            download: `${HUB}/storage/v1/object/sign/creator-kit/study-01/4/2.jpg?token=t&download=basalt-study-01-2.jpg`,
          },
        ],
      },
    ]);
    expect(waiting).toEqual(["discipline"]);
  });
});
