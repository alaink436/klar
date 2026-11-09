// SERVER ONLY. Who may call /api/routines: a caller with a vault:use token (lib/apiTokens), the one the cloud routines
// already carry. That token can already post through Blotato and spend Higgsfield credits via the vault proxy, so
// reading posting times and reporting scheduled drafts gives it nothing new. Returns null when the caller passes,
// otherwise the response to send.

import "server-only";
import { clientIp, rateLimit } from "./apiGuards";
import { verifyToken } from "./apiTokens";

function bearer(req: Request): string {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") ?? "").trim());
  return m ? m[1].trim() : "";
}

export async function routineCaller(req: Request): Promise<Response | null> {
  const rl = rateLimit("routines", clientIp(req), 60, 60_000);
  if (!rl.ok) return Response.json({ error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429 });
  const tok = bearer(req);
  if (!tok || !(await verifyToken(tok, "vault:use"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  return null;
}
