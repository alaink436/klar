import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOARD_APPS, BoardError, createIdea, fetchIdeas, fetchWishes, promoteWish, setIdeaStatus, setIdeaVersion } from "./board";

// The vault hands out the Anthropic key; here it always has one.
vi.mock("./vault", () => ({
  getForProxy: async () => ({ baseUrl: "https://api.anthropic.com", authHeader: "x-api-key", authScheme: "", authIn: "header", key: "test" }),
}));

const BASALT = BOARD_APPS[0];
const DB = "https://basalt.test";

type Call = { url: string; method: string; body: unknown };

// One fake for both sides: Claude answers every field as "<lang>:<text>", the
// app database answers from `db`. Every request is recorded.
function fake(db: (url: string, method: string, body: unknown) => unknown, claude: { status?: number } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input instanceof Request ? input.url : input);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url, method, body });
      if (url.startsWith("https://api.anthropic.com")) {
        if (claude.status) return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "no" } }), { status: claude.status });
        const [head, json] = String(body.messages[0].content).split("\n\n");
        const langs = head.replace("Languages: ", "").split(", ");
        const items = JSON.parse(json) as Record<string, Record<string, string>>;
        const out = Object.fromEntries(
          Object.entries(items).map(([k, fields]) => [
            k,
            Object.fromEntries(langs.map((l) => [l, Object.fromEntries(Object.entries(fields).map(([f, v]) => [f, `${l}:${v}`]))])),
          ]),
        );
        return new Response(
          JSON.stringify({
            id: "msg_1", type: "message", role: "assistant", model: body.model,
            content: [{ type: "text", text: JSON.stringify(out) }],
            stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(db(url, method, body)), { headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

const toDb = (calls: Call[]) => calls.filter((c) => c.url.startsWith(DB));
const IDEA = "11111111-1111-4111-8111-111111111111";
const WISH = "22222222-2222-4222-8222-222222222222";

describe("board", () => {
  beforeEach(() => {
    vi.stubEnv("KLAR_ADMIN_APPS", JSON.stringify([{ slug: "wavelength", name: "Basalt", supabaseUrl: DB, serviceKey: "k" }]));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("a new idea keeps the app's source language in title and every language in translations", async () => {
    const calls = fake(() => [{ id: IDEA }]);
    expect(await createIdea(BASALT, { title: "Wochenrückblick", detail: "am sonntag" })).toBe(IDEA);

    const [insert] = toDb(calls);
    expect(insert.url).toBe(`${DB}/rest/v1/feature_ideas`);
    expect(insert.method).toBe("POST");
    const row = insert.body as { title: string; detail: string; translations: Record<string, { title: string }> };
    expect(row.title).toBe("en:Wochenrückblick");
    expect(row.detail).toBe("en:am sonntag");
    expect(Object.keys(row.translations).sort()).toEqual([...BASALT.langs].sort());
    expect(row.translations.de.title).toBe("de:Wochenrückblick");
  });

  it("when Claude fails, nothing reaches the database", async () => {
    const calls = fake(() => [{ id: IDEA }], { status: 400 });
    await expect(createIdea(BASALT, { title: "Wochenrückblick", detail: "" })).rejects.toThrow(BoardError);
    expect(toDb(calls)).toHaveLength(0);
  });

  it("an unknown status is refused before any request", async () => {
    const calls = fake(() => [{ id: IDEA }]);
    await expect(setIdeaStatus(BASALT, IDEA, "done")).rejects.toThrow("Unbekannter Stand.");
    expect(calls).toHaveLength(0);
  });

  it("a shipped idea takes its version, trimmed, and only while it is shipped", async () => {
    const calls = fake(() => [{ id: IDEA }]);
    expect(await setIdeaVersion(BASALT, IDEA, " 2.10.0 ")).toBe("2.10.0");
    expect(toDb(calls)).toEqual([
      { url: `${DB}/rest/v1/feature_ideas?id=eq.${IDEA}&status=eq.shipped`, method: "PATCH", body: { shipped_in: "2.10.0" } },
    ]);
  });

  it("an empty version clears it", async () => {
    const calls = fake(() => [{ id: IDEA }]);
    expect(await setIdeaVersion(BASALT, IDEA, "  ")).toBeNull();
    expect(toDb(calls)[0].body).toEqual({ shipped_in: null });
  });

  it("a version that is not Major.Minor.Patch is refused before any request", async () => {
    const calls = fake(() => [{ id: IDEA }]);
    for (const bad of ["2.7", "02.7.0", "2.07.0", "v2.7.0", "2.7.0.1", "2.7.x", "2..0", "2.7.0-beta", "2.7.0\n1"]) {
      await expect(setIdeaVersion(BASALT, IDEA, bad)).rejects.toThrow("Major.Minor.Patch");
    }
    expect(calls).toHaveLength(0);
  });

  it("an idea that is not shipped gets no version", async () => {
    fake(() => []);
    await expect(setIdeaVersion(BASALT, IDEA, "2.7.0")).rejects.toThrow("nur beim Stand fertig");
  });

  it("leaving shipped clears the version, setting shipped keeps it", async () => {
    const calls = fake(() => [{ id: IDEA }]);
    await setIdeaStatus(BASALT, IDEA, "building");
    await setIdeaStatus(BASALT, IDEA, "shipped");
    expect(toDb(calls).map((c) => c.body)).toEqual([{ status: "building", shipped_in: null }, { status: "shipped" }]);
  });

  it("ideas carry their version from the database", async () => {
    const calls = fake(() => [
      { id: IDEA, title: "a", detail: null, status: "shipped", weight: 0, created_at: "2026-10-16T10:00:00Z", translations: {}, shipped_in: "2.7.0", feature_votes: [{ count: 3 }] },
    ]);
    const [idea] = await fetchIdeas(BASALT);
    expect(idea.shippedIn).toBe("2.7.0");
    expect(toDb(calls)[0].url).toContain("shipped_in");
  });

  it("a wish goes on the board through promote_wish, then gets its translations", async () => {
    const calls = fake((url) => (url.includes("rpc/promote_wish") ? { id: IDEA } : [{ id: IDEA }]));
    expect(await promoteWish(BASALT, WISH, { title: "kalorien zählen", detail: "" })).toBe(IDEA);

    const [rpc, patch] = toDb(calls);
    expect(rpc.url).toBe(`${DB}/rest/v1/rpc/promote_wish`);
    expect(rpc.body).toEqual({ p_wish_id: WISH, p_title: "en:kalorien zählen", p_detail: null });
    expect(patch.url).toBe(`${DB}/rest/v1/feature_ideas?id=eq.${IDEA}`);
    expect(Object.keys((patch.body as { translations: object }).translations)).toHaveLength(BASALT.langs.length);
  });

  it("wishes without a German copy are translated once and stored", async () => {
    const calls = fake((url, method) =>
      method === "GET"
        ? [
            { id: WISH, body: "I want to get abs", body_de: null, created_at: "2026-10-12T10:00:00Z", promoted_idea_id: null, read_at: null },
            { id: IDEA, body: "track calories", body_de: "Kalorien zählen", created_at: "2026-10-13T10:00:00Z", promoted_idea_id: null, read_at: null },
          ]
        : [],
    );
    const { wishes, warning } = await fetchWishes(BASALT);
    expect(warning).toBeNull();
    expect(wishes.map((w) => w.bodyDe)).toEqual(["de:I want to get abs", "Kalorien zählen"]);

    const asked = calls.find((c) => c.url.startsWith("https://api.anthropic.com"))!;
    expect(String((asked.body as { messages: { content: string }[] }).messages[0].content)).not.toContain("track calories");
    const patches = toDb(calls).filter((c) => c.method === "PATCH");
    expect(patches).toEqual([{ url: `${DB}/rest/v1/feature_wishes?id=eq.${WISH}`, method: "PATCH", body: { body_de: "de:I want to get abs" } }]);
  });
});
