// POST /admin/outreach/language?json=1 — change a target's outreach language.
// Called from the inbox detail header (fetch + soft-refresh), so it answers
// JSON rather than redirecting. Same admin-cookie gate as the other outreach
// mutation routes.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { setOutreachLanguage } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY || !ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.json({ ok: false, msg: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, msg: "bad form" }, { status: 400 });
  }

  const id = String(form.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, msg: "id ungültig" }, { status: 400 });
  const language = String(form.get("language") ?? "").trim().toLowerCase();

  try {
    const row = await setOutreachLanguage(id, language);
    return NextResponse.json({ ok: true, language: row.language });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, msg: msg.slice(0, 160) }, { status: 400 });
  }
}
