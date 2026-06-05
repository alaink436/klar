// Vault proxy — "use but don't see". An agent with a vault:use token calls
//   /api/vault/proxy/<secretId>/<provider path…>
// and this handler decrypts the matching API key server-side, injects it into
// the outbound request to the provider, and streams the response back. The key
// is never returned to the caller.
//
// Auth: Authorization: Bearer <token with scope vault:use>.
// Master key (VAULT_MASTER_KEY) lives only in the server env.

import { verifyToken } from "@/lib/apiTokens";
import { getForProxy, vaultReady } from "@/lib/vault";
import { clientIp, rateLimit } from "@/lib/apiGuards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function bearer(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : "";
}

async function handle(
  req: Request,
  ctx: { params: Promise<{ id: string; path?: string[] }> },
): Promise<Response> {
  if (!vaultReady()) return json({ error: "vault not configured" }, 503);

  const rl = rateLimit("vault_proxy", clientIp(req), 120, 60 * 60 * 1000);
  if (!rl.ok) return json({ error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds }, 429);

  const tok = bearer(req);
  if (!tok || !(await verifyToken(tok, "vault:use"))) {
    return json({ error: "unauthorized" }, 401);
  }

  const { id, path } = await ctx.params;
  const secret = await getForProxy(id);
  if (!secret) return json({ error: "unknown or revoked secret" }, 404);

  const sub = (path ?? []).join("/");
  const search = new URL(req.url).search;
  const target = `${secret.baseUrl}${sub ? `/${sub}` : ""}${search}`;

  // Forward only safe request headers; inject the decrypted key on the
  // configured auth header. The incoming Authorization (our vault token) is
  // dropped — never forwarded upstream.
  const fwd = new Headers();
  for (const h of ["content-type", "accept", "anthropic-version", "openai-organization"]) {
    const v = req.headers.get(h);
    if (v) fwd.set(h, v);
  }
  fwd.set(secret.authHeader, `${secret.authScheme}${secret.key}`);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers: fwd,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return json({ error: "upstream request failed" }, 502);
  }

  const respHeaders = new Headers();
  for (const h of ["content-type", "content-disposition", "x-request-id"]) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  respHeaders.set("Cache-Control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
