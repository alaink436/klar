// POST /admin/reply-templates/delete — delete one reply template by id.
// Form-POST: id (uuid).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { deleteReplyTemplate } from "../../../../lib/replyTemplateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin/reply-templates?msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured: KLAR_ADMIN_KEY missing");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form");
  }

  const id = String(form.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return back(req, "id ungültig");

  try {
    await deleteReplyTemplate(id);
    return back(req, "Vorlage gelöscht");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Löschen fehlgeschlagen: ${msg.slice(0, 160)}`);
  }
}
