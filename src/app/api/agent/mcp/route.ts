// The agent gateway: an MCP server for outside agents (a Grok bot). Two tools, each behind
// its own token scope: brain_search (brain:read) and start_claude (claude:start).
//
// Auth: Authorization: Bearer <klr_ token>, made in Klar Control under AI-Brain, Zugang.
// Stateless Streamable HTTP: one JSON-RPC message per POST, answered as JSON; there is no
// server stream, so GET is refused.

import { AGENT_INSTRUCTIONS, AGENT_TOOLS } from "@/lib/agentTools";
import { answer } from "@/lib/agentMcp";
import { clientIp, exceedsContentLength, rateLimitBurst } from "@/lib/apiGuards";
import { verifyToken } from "@/lib/apiTokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" };
const json = (obj: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { ...NO_STORE, ...extra } });

export async function POST(req: Request): Promise<Response> {
  // Agents send no Origin; a browser page of another site does, and gets nothing.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return json({ error: "Requests from other sites are refused." }, 403);

  // Flood dampening before the token lookup; the token check below is the boundary.
  const rl = rateLimitBurst("agent_mcp", clientIp(req), 60, 1);
  if (!rl.ok) return json({ error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds }, 429);
  if (exceedsContentLength(req, 64 * 1024)) return json({ error: "The message is too large." }, 413);

  const raw = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  const token = raw ? ((await verifyToken(raw, "brain:read")) ?? (await verifyToken(raw, "claude:start"))) : null;
  if (!token) {
    return json({ error: "Missing or unknown token. Make one in Klar Control under AI-Brain, Zugang." }, 401, {
      "WWW-Authenticate": 'Bearer realm="Klar"',
    });
  }

  let message: unknown;
  try {
    message = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "The body is not JSON." } }, 400);
  }
  const reply = await answer(message, { scopes: token.scopes, tools: AGENT_TOOLS, ctx: { tokenId: token.id }, instructions: AGENT_INSTRUCTIONS });
  return reply ? json(reply) : new Response(null, { status: 202, headers: NO_STORE });
}

export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
export const DELETE = GET;
