// POST /api/userjot/sign: ein Board-Link, der den Nutzer einer App auf UserJot
// gleich anmeldet (lib/userjot, automatische Anmeldung). Body {app, name?},
// Header Authorization: Bearer <Access-Token der App>. Antwort {url}.
//
// Oeffentlich, weil die Apps ihn aufrufen; geschuetzt dadurch, dass nur ein
// gueltiges Login bei der App eine Signatur bekommt, und nur fuer die eigene
// Nutzer-ID. Ohne Login 401, ohne Geheimnis im Vault 503: die App oeffnet das
// Board dann ohne Anmeldung, wie bisher.

import { NextResponse } from "next/server";
import { clientIp, exceedsContentLength, rateLimit } from "@/lib/apiGuards";
import { appUser, findUserjotApp, loginSecret, SIGN_WEB_ORIGINS, signedBoardUrl } from "@/lib/userjot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Learnbound ruft die Route auch von learnbound.app im Browser auf: mit
// Authorization-Header braucht das einen Preflight und CORS-Header.
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !SIGN_WEB_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request): Promise<Response> {
  const cors = corsHeaders(req);
  if (exceedsContentLength(req, 2048)) return NextResponse.json({ error: "too large" }, { status: 413, headers: cors });
  if (!rateLimit("userjot-sign", clientIp(req), 30, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "slow down" }, { status: 429, headers: cors });
  }
  const body = (await req.json().catch(() => null)) as { app?: unknown; name?: unknown } | null;
  const app = findUserjotApp(typeof body?.app === "string" ? body.app : null);
  if (!app) return NextResponse.json({ error: "unknown app" }, { status: 400, headers: cors });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const user = token ? await appUser(app, token) : null;
  if (!user) return NextResponse.json({ error: "no login" }, { status: 401, headers: cors });

  const secret = await loginSecret();
  if (!secret) return NextResponse.json({ error: "not set up" }, { status: 503, headers: cors });

  const name = typeof body?.name === "string" ? body.name.slice(0, 60) : null;
  return NextResponse.json({ url: signedBoardUrl(app, { id: user.id, firstName: name }, secret) }, { headers: { ...NO_STORE, ...cors } });
}
