import { describe, expect, it, vi } from "vitest";

// One token with brain:read only; everything else is unknown.
vi.mock("@/lib/apiTokens", () => ({
  verifyToken: async (raw: string, required: string) =>
    raw === "klr_good" && required === "brain:read" ? { id: "tok-1", scopes: ["brain:read"] } : null,
}));
vi.mock("@/lib/vault", () => ({ listSecrets: async () => [], getForProxy: async () => null }));

const { GET, POST } = await import("./route");

let ip = 0;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://getklar.org/api/agent/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const LIST = { jsonrpc: "2.0", id: 1, method: "tools/list" };
const good = { authorization: "Bearer klr_good" };

describe("/api/agent/mcp", () => {
  it("refuses a missing or unknown token before it reads the message", async () => {
    const tries: Record<string, string>[] = [{}, { authorization: "Bearer klr_bad" }, { authorization: "klr_good" }];
    for (const headers of tries) {
      const res = await post(LIST, headers);
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("refuses another site's page and every method but POST", async () => {
    expect((await post(LIST, { ...good, origin: "https://evil.example" })).status).toBe(403);
    expect(GET().status).toBe(405);
  });

  it("shows a brain:read token the search and not the start", async () => {
    const res = await post(LIST, good);
    expect(res.status).toBe(200);
    const names = ((await res.json()).result.tools as { name: string }[]).map((t) => t.name);
    expect(names).toEqual(["brain_search"]);
    const call = await post({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "start_claude", arguments: { task: "x" } } }, good);
    expect((await call.json()).result).toMatchObject({ isError: true });
  });

  it("answers broken JSON with 400 and a notification with 202", async () => {
    expect((await post("{", good)).status).toBe(400);
    expect((await post({ jsonrpc: "2.0", method: "notifications/initialized" }, good)).status).toBe(202);
  });
});
