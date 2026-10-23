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
import { appUser, findUserjotApp, loginSecret, signedBoardUrl } from "@/lib/userjot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request): Promise<Response> {
  if (exceedsContentLength(req, 2048)) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!rateLimit("userjot-sign", clientIp(req), 30, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "slow down" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { app?: unknown; name?: unknown } | null;
  const app = findUserjotApp(typeof body?.app === "string" ? body.app : null);
  if (!app) return NextResponse.json({ error: "unknown app" }, { status: 400 });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const user = token ? await appUser(app, token) : null;
  if (!user) return NextResponse.json({ error: "no login" }, { status: 401 });

  const secret = await loginSecret();
  if (!secret) return NextResponse.json({ error: "not set up" }, { status: 503 });

  const name = typeof body?.name === "string" ? body.name.slice(0, 60) : null;
  return NextResponse.json({ url: signedBoardUrl(app, { id: user.id, firstName: name }, secret) }, { headers: NO_STORE });
}
