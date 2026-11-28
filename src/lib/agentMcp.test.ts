import { describe, expect, it } from "vitest";
import { answer, type AgentTool } from "./agentMcp";

const TOOLS: AgentTool<null>[] = [
  { name: "look", scope: "brain:read", description: "reads", run: async (_c, a) => ({ got: a.q ?? null }) },
  { name: "go", scope: "claude:start", description: "starts", run: async () => { throw new Error("no routine"); } },
];
const server = (scopes: string[]) => ({ scopes, tools: TOOLS, ctx: null, instructions: "hi" });
const call = (name: unknown, args?: unknown) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
const names = (a: Awaited<ReturnType<typeof answer>>) => (a?.result as { tools: { name: string }[] }).tools.map((t) => t.name);
const text = (a: Awaited<ReturnType<typeof answer>>) => (a?.result as { content: { text: string }[]; isError?: boolean });

describe("answer", () => {
  it("lists only the tools the token's scopes reach", async () => {
    const list = { jsonrpc: "2.0", id: 1, method: "tools/list" };
    expect(names(await answer(list, server(["brain:read"])))).toEqual(["look"]);
    expect(names(await answer(list, server(["claude:start"])))).toEqual(["go"]);
    expect(names(await answer(list, server(["*"])))).toEqual(["look", "go"]);
    expect(names(await answer(list, server(["vault:use"])))).toEqual([]);
  });

  it("refuses a call outside the token's scopes without running the tool", async () => {
    const r = text(await answer(call("go"), server(["brain:read"])));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("claude:start");
  });

  it("runs a tool and turns a thrown error into an error result", async () => {
    expect(text(await answer(call("look", { q: "x" }), server(["brain:read"]))).content[0].text).toContain('"got": "x"');
    const failed = text(await answer(call("go"), server(["claude:start"])));
    expect(failed).toMatchObject({ isError: true, content: [{ text: "no routine" }] });
  });

  it("answers the protocol's edges", async () => {
    expect(await answer({ jsonrpc: "2.0", method: "notifications/initialized" }, server([]))).toBeNull();
    expect((await answer("nope", server([])))?.error?.code).toBe(-32600);
    expect((await answer({ jsonrpc: "2.0", id: 1, method: "nope" }, server([])))?.error?.code).toBe(-32601);
    expect((await answer(call({ toString: 1 }), server(["*"])))?.error?.code).toBe(-32602);
    const init = await answer({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, server([]));
    expect(init?.result).toMatchObject({ protocolVersion: "2025-06-18", instructions: "hi" });
  });
});
