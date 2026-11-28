// The MCP server for outside agents (a Grok bot, any MCP client) in its smallest form:
// Streamable HTTP without sessions or a server stream. Every POST carries one JSON-RPC
// message and gets one JSON answer, so there is no SDK. Same shape as the gateway of the
// OurApps dashboard; here a tool is gated by a token scope instead of a tier.
import type { Scope } from "./apiTokens";

export type AgentTool<C> = {
  name: string;
  description: string;
  /** The token scope that may call it; tools/list shows a token only the tools it may call. */
  scope: Scope;
  /** JSON Schema properties of the arguments. */
  input?: Record<string, unknown>;
  required?: string[];
  run: (ctx: C, args: Record<string, unknown>) => Promise<unknown>;
};

type Id = string | number;
export type Answer = { jsonrpc: "2.0"; id: Id | null; result?: unknown; error?: { code: number; message: string } };

const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const ok = (id: Id, result: unknown): Answer => ({ jsonrpc: "2.0", id, result });
const fail = (id: Id | null, code: number, message: string): Answer => ({ jsonrpc: "2.0", id, error: { code, message } });
const content = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  ...(isError && { isError: true }),
});
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const reaches = (scopes: string[], scope: Scope) => scopes.includes(scope) || scopes.includes("*");

/** The answer to one JSON-RPC message, or null for a notification (or a client's response), which get none. */
export async function answer<C>(
  message: unknown,
  server: { scopes: string[]; tools: AgentTool<C>[]; ctx: C; instructions: string },
): Promise<Answer | null> {
  if (!isRecord(message) || message.jsonrpc !== "2.0") return fail(null, -32600, "Send one JSON-RPC 2.0 message per request.");
  const { id, method } = message;
  if (id === undefined || typeof method !== "string") return null;
  if (typeof id !== "string" && typeof id !== "number") return fail(null, -32600, "The id must be a string or a number.");
  const params = isRecord(message.params) ? message.params : {};

  switch (method) {
    case "initialize": {
      const asked = params.protocolVersion;
      return ok(id, {
        protocolVersion: typeof asked === "string" && PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "klar-agent", version: "1.0.0" },
        instructions: server.instructions,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: server.tools
          .filter((t) => reaches(server.scopes, t.scope))
          .map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: { type: "object", properties: t.input ?? {}, ...(t.required && { required: t.required }), additionalProperties: false },
          })),
      });
    case "tools/call": {
      // Only a string counts as a name; String() on an object with its own toString would throw.
      const name = typeof params.name === "string" ? params.name : "";
      const tool = server.tools.find((t) => t.name === name);
      if (!tool) return fail(id, -32602, name ? `Unknown tool: ${name}` : "tools/call needs the tool's name as a string.");
      if (!reaches(server.scopes, tool.scope)) {
        return ok(id, content(`${tool.name} needs a token with the scope "${tool.scope}".`, true));
      }
      try {
        return ok(id, content(await tool.run(server.ctx, isRecord(params.arguments) ? params.arguments : {})));
      } catch (e) {
        return ok(id, content(e instanceof Error ? e.message : String(e), true));
      }
    }
    default:
      return fail(id, -32601, `Unknown method: ${method}`);
  }
}
