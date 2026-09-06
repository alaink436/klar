// GET /admin/mycakeday/anhang?mail=…&id=… — ein Anhang aus dem
// MyCakeDay-Postfach. Die Datei liegt bei Resend, die Adressen laufen ab;
// mycakeday.ch holt bei jedem Klick eine frische, und diese Route leitet
// dorthin. 302 und nicht 301: die Zieladresse ist zeitlich begrenzt.
//
// Unter /admin und nicht /api, damit die Admin-Cookies mitgeprueft werden —
// sonst laedt jeder mit einer geratenen Kennung Kundenpost herunter.

import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/app/admin/_shared";
import { cakedayAnhang } from "@/lib/cakeday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await checkAuth(req);
  if (!auth.authed) return NextResponse.redirect(new URL("/admin/login", req.url), 303);

  const mail = (req.nextUrl.searchParams.get("mail") ?? "").slice(0, 80);
  const id = (req.nextUrl.searchParams.get("id") ?? "").slice(0, 80);
  if (!mail || !id) return new Response("Fehlende Kennung.", { status: 400 });

  const ziel = await cakedayAnhang(mail, id);
  if (!ziel) return new Response("Dieser Anhang ist nicht mehr abrufbar.", { status: 404 });
  return NextResponse.redirect(ziel, 302);
}
