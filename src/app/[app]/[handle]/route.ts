// Kurzlink eines Creators: getklar.org/<kuerzel>/<handle>. Mit Detour geht es
// auf den Detour-Link der App mit `?ref=<handle>`, ohne Detour oder fuer einen
// unbekannten Creator in den Store der App. Ein Kuerzel, das keiner App gehoert,
// ist ein 404. 302 statt 301, damit ein entfernter Creator nicht im
// Browser-Cache weiterlebt. Siehe src/lib/creators.ts.
//
// Liegt als `[app]` im Wurzelordner, damit eine neue App ohne neuen Ordner
// Kurzlinks bekommt. Echte Seiten wie /basalt/privacy und /admin/... sind
// statisch und gewinnen immer.

import { NextResponse } from "next/server";
import { creatorRedirect } from "@/lib/creators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ app: string; handle: string }> },
): Promise<Response> {
  const { app, handle } = await params;
  const ziel = await creatorRedirect(app.toLowerCase(), handle);
  if (!ziel) return new Response("Not found", { status: 404 });
  return NextResponse.redirect(ziel, 302);
}
