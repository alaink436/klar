// GET /admin/mycakeday/oeffnen?weiter=/admin/postfach — der Absprung ins
// Cakeday-Dashboard ohne zweiten Login.
//
// Klar Control hat Admin-Key, Geraet und TOTP schon verlangt (checkAuth).
// Darauf gestuetzt holt diese Route bei mycakeday.ch einen einmaligen
// Anmeldelink fuer das Betriebskonto (POST /api/klar/handoff, Bearer aus dem
// gemeinsamen Geheimnis) und leitet den Browser dorthin. mycakeday.ch loest
// den Link ein, setzt seine Supabase-Sitzung und landet auf `weiter`.
//
// ⚠️ Die Umleitung geht nur auf eine Adresse unter CAKEDAY_URL
// (lib/cakeday.ts prueft das). Ein fremder Server bestimmt hier nichts.

import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/app/admin/_shared";
import { cakedayHandoff } from "@/lib/cakeday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await checkAuth(req);
  if (!auth.authed) return NextResponse.redirect(new URL("/admin/login", req.url), 303);

  const roh = (req.nextUrl.searchParams.get("weiter") ?? "/admin/postfach").slice(0, 300);
  // Nur ein Pfad. Was mycakeday.ch daraus macht, prueft es selbst noch einmal.
  const weiter = roh.startsWith("/") && !roh.startsWith("//") ? roh : "/admin/postfach";

  const link = await cakedayHandoff(weiter);
  if (!link.ok) {
    const q = new URLSearchParams({ stand: "fehler", msg: `Absprung nicht möglich: ${link.meldung}`.slice(0, 400) });
    return NextResponse.redirect(new URL(`/admin/mycakeday?${q}`, req.url), 303);
  }
  // 303 statt 302 mit Absicht: der Link ist einmalig, und ein Browser, der
  // eine 302 aus dem Verlauf wiederholt, liefe in „Link gilt nicht mehr".
  return NextResponse.redirect(link.url, 303);
}
