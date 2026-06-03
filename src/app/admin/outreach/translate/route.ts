// POST /admin/outreach/translate — übersetzt eine eingegangene Affiliate-Reply
// nach Deutsch (oder Zielsprache). Wird per fetch() aus dem Reply-Inbox-UI
// aufgerufen und liefert JSON zurück (kein Redirect). Cookie-auth wie der Rest
// des Admin-Bereichs; bei Fehler 401/400/502 mit {ok:false,error}.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { translateText } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY || !ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { text?: string; target?: string; source?: string };
  try {
    body = (await req.json()) as { text?: string; target?: string; source?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const text = String(body.text ?? "");
  const target = String(body.target ?? "DE");
  // Quellsprache-Hint (Sprache des Targets) — nur der MyMemory-Fallback nutzt
  // ihn, Google/DeepL erkennen selbst. Optional.
  const source = body.source ? String(body.source) : undefined;
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  const r = await translateText(text, target, source);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
