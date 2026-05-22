// POST /admin/outreach/delete — hard delete. Erfordert die explizite UUID.
// Prefer "mark as dead" via /admin/outreach/update wenn du Stats behalten willst.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { deleteOutreachTarget } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=outreach&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured");
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
    await deleteOutreachTarget(id);
    return back(req, `Target gelöscht`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Delete fehlgeschlagen: ${msg.slice(0, 120)}`);
  }
}
