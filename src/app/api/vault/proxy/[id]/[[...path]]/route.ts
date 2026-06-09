// Vault proxy — "use but don't see". An agent with a vault:use token calls
//   /api/vault/proxy/<secretId>/<provider path…>
// and this handler decrypts the matching API key server-side, injects it into
// the outbound request to the provider, and streams the response back. The key
// is never returned to the caller.
//
// Auth: Authorization: Bearer <token with scope vault:use>.
// Master key (VAULT_MASTER_KEY) lives only in the server env.

import { verifyToken, touchTokenUsed } from "@/lib/apiTokens";
import { getForProxy, vaultReady, touchSecretUsed } from "@/lib/vault";
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
  if (!tok) return json({ error: "unauthorized" }, 401);

  const { id, path } = await ctx.params;

  // Token check and secret fetch are independent — run both Supabase round-trips
  // in parallel (one RTT instead of two before the upstream call). Stamp "last
  // used" on token + secret only after BOTH pass, so a valid id paired with a
  // bad token never marks the secret as used.
  const [auth, secret] = await Promise.all([
    verifyToken(tok, "vault:use", { touch: false }),
    getForProxy(id, { touch: false }),
  ]);
  if (!auth) return json({ error: "unauthorized" }, 401);
  if (!secret) return json({ error: "unknown or revoked secret" }, 404);
  touchTokenUsed(auth.id);
  touchSecretUsed(id);

  const sub = (path ?? []).join("/");
  // Preserve the caller's query params. For query-param auth (e.g. Evomi
  // ?api_key=), inject the decrypted key as an extra param — authHeader holds the
  // param name. URLSearchParams round-trips already-encoded values (e.g. ?url=…)
  // cleanly, so this is safe for both auth modes.
  const params = new URL(req.url).searchParams;
  if (secret.authIn === "query") params.set(secret.authHeader, secret.key);
  const qs = params.toString();
  const target = `${secret.baseUrl}${sub ? `/${sub}` : ""}${qs ? `?${qs}` : ""}`;

  // Forward only safe request headers; inject the decrypted key on the
  // configured auth header. The incoming Authorization (our vault token) is
  // dropped — never forwarded upstream.
  const fwd = new Headers();
  for (const h of ["content-type", "accept", "user-agent", "anthropic-version", "openai-organization"]) {
    const v = req.headers.get(h);
    if (v) fwd.set(h, v);
  }
  // GitHub (and a few other APIs) reject requests without a User-Agent. Forward
  // the caller's if present, otherwise send a stable default so they don't 403.
  if (!fwd.has("user-agent")) fwd.set("user-agent", "klar-vault-proxy");
  // Header auth: inject the key on the configured header. Query auth already
  // injected it into the URL above, so no auth header here.
  if (secret.authIn !== "query") fwd.set(secret.authHeader, `${secret.authScheme}${secret.key}`);

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
