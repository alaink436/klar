// Kurzlink eines Basalt-Creators: getklar.org/basalt/<handle> leitet auf seinen
// Detour-Link weiter. Gibt es den Creator nicht (mehr), geht es auf die
// Basalt-Seite. 302 statt 301, damit ein entfernter Creator nicht im Browser-
// Cache weiterlebt. Siehe src/lib/creators.ts.

import { NextResponse, type NextRequest } from "next/server";
import { creatorRedirect } from "@/lib/creators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await params;
  const ziel = await creatorRedirect("basalt", handle);
  return NextResponse.redirect(ziel ?? new URL("/basalt", req.url), 302);
}
