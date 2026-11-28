import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIRE = "https://api.anthropic.com/v1/claude_code/routines/trig_01Abc/fire";
let entries: { id: string; provider: string; revoked_at: string | null; base_url: string | null }[] = [];
let baseUrl = FIRE;
vi.mock("./vault", () => ({
  listSecrets: async () => entries,
  getForProxy: async () => ({ baseUrl, authHeader: "Authorization", authScheme: "Bearer ", authIn: "header", key: "tok" }),
}));

const { AGENT_TOOLS, FIRE_URL, literal, taskText } = await import("./agentTools");
const tool = (name: string) => AGENT_TOOLS.find((t) => t.name === name)!;
const fetchMock = vi.fn();

beforeEach(() => {
  entries = [{ id: "s1", provider: "claude-routine", revoked_at: null, base_url: FIRE }];
  baseUrl = FIRE;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("literal", () => {
  it("wraps text in a dollar tag the text cannot close", () => {
    const hostile = "x'; drop table brain.sections; -- $$ $b$";
    const q = literal(hostile);
    const tag = q.slice(0, q.indexOf("$", 1) + 1);
    expect(tag).toMatch(/^\$b[0-9a-f]{12}\$$/);
    expect(q).toBe(`${tag}${hostile}${tag}`);
    expect(hostile).not.toContain(tag);
  });
});

describe("FIRE_URL", () => {
  it("accepts only a routine's fire endpoint at Anthropic", () => {
    expect(FIRE_URL.test(FIRE)).toBe(true);
    expect(FIRE_URL.test("https://api.anthropic.com.evil.example/v1/claude_code/routines/trig_1/fire")).toBe(false);
    expect(FIRE_URL.test("https://example.org/v1/claude_code/routines/trig_1/fire")).toBe(false);
    expect(FIRE_URL.test(`${FIRE}?x=1`)).toBe(false);
  });
});

describe("start_claude", () => {
  it("fires the routine with the task marked as a bot's request", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ claude_code_session_id: "session_1", claude_code_session_url: "https://claude.ai/code/session_1" })));
    const out = await tool("start_claude").run({ tokenId: "t-ok" }, { task: "Shorten the caption of post 12.", project: "Kelva" });
    expect(out).toEqual({ started: true, session_id: "session_1", session_url: "https://claude.ai/code/session_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(FIRE);
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok", "anthropic-version": "2026-10-21" });
    expect(init.redirect).toBe("manual");
    expect(JSON.parse(init.body).text).toBe(taskText("t-ok", "Shorten the caption of post 12.", "Kelva"));
    expect(taskText("t-ok", "x", null)).toContain("not Alain");
  });

  it("does not send the token when no routine is connected or the entry points elsewhere", async () => {
    entries = [{ id: "s1", provider: "claude-routine", revoked_at: "2026-11-01", base_url: FIRE }];
    await expect(tool("start_claude").run({ tokenId: "t-a" }, { task: "x" })).rejects.toThrow("No routine is connected");
    entries = [{ id: "s1", provider: "claude-routine", revoked_at: null, base_url: "https://example.org/fire" }];
    baseUrl = "https://example.org/fire";
    await expect(tool("start_claude").run({ tokenId: "t-a" }, { task: "x" })).rejects.toThrow("does not hold a fire URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops one token after ten tasks in an hour", async () => {
    fetchMock.mockImplementation(async () => new Response("{}"));
    for (let i = 0; i < 10; i++) await tool("start_claude").run({ tokenId: "t-many" }, { task: "x" });
    await expect(tool("start_claude").run({ tokenId: "t-many" }, { task: "x" })).rejects.toThrow("At most 10 tasks per hour");
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("refuses an empty or oversized task and a project with odd characters", async () => {
    const run = (args: Record<string, unknown>) => tool("start_claude").run({ tokenId: "t-v" }, args);
    await expect(run({ task: "  " })).rejects.toThrow('"task" must be');
    await expect(run({ task: "x".repeat(8001) })).rejects.toThrow("longer than 8000");
    await expect(run({ task: "x", project: "a'; --" })).rejects.toThrow('"project" may hold');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the routine's status without its body", async () => {
    fetchMock.mockResolvedValue(new Response("secret detail", { status: 401 }));
    await expect(tool("start_claude").run({ tokenId: "t-e" }, { task: "x" })).rejects.toThrow("the routine answered 401.");
  });
});

describe("brain_search", () => {
  it("embeds the question and returns the sections", async () => {
    baseUrl = "https://upstream.example";
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ embedding: Array(1024).fill(0.5) }] })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ r: { commit: "abc", hits: [{ path: "Projects/Kelva/PROGRESS.md", heading_path: "Kelva > Status", line_start: 3, line_end: 9, content: "live", score: 0.03 }] } }])),
      );
    const out = await tool("brain_search").run({ tokenId: "t" }, { question: "wo steht Kelva's Stand?", limit: 3, project: "Kelva" });
    expect(out).toEqual({ indexed_commit: "abc", hits: [{ path: "Projects/Kelva/PROGRESS.md", heading: "Kelva > Status", lines: "3-9", text: "live" }] });
    const sql = JSON.parse(fetchMock.mock.calls[1][1].body).query as string;
    expect(sql).toMatch(/\$b[0-9a-f]{12}\$wo steht Kelva's Stand\?\$b[0-9a-f]{12}\$/);
    expect(sql).toMatch(/,\s+3, \$b[0-9a-f]{12}\$Kelva\$b/);
  });

  it("refuses a limit outside 1 to 10 and a wrong embedding", async () => {
    await expect(tool("brain_search").run({ tokenId: "t" }, { question: "x", limit: "5; drop" })).rejects.toThrow('"limit" must be');
    await expect(tool("brain_search").run({ tokenId: "t" }, { question: "x", limit: 11 })).rejects.toThrow('"limit" must be');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ embedding: [1, 2] }] })));
    await expect(tool("brain_search").run({ tokenId: "t" }, { question: "x" })).rejects.toThrow("unexpected shape");
  });
});
