// POST /admin/inbox/translate: übersetzt eine eingegangene Nachricht der Inbox
// nach Deutsch (oder Zielsprache). Wird per fetch() aus dem Inbox-UI
// aufgerufen und liefert JSON zurück (kein Redirect). Cookie-auth wie der Rest
// des Admin-Bereichs; bei Fehler 401/400/502 mit {ok:false,error}.
// Lag bis 2026-10-07 unter /admin/outreach/translate.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/adminGuard";
import { translateText } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req);
  if (!auth.ok) return auth.response;

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
