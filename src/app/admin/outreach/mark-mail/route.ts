// POST /admin/outreach/mark-mail — inkrementiert mails_sent + setzt last_mail_at.
// Klick auf "Mail ✓" wenn der Admin manuell eine Outreach-Mail rausschickt
// (DM-Follow-up, Wise-Setup-Mail, Quartals-Check-in, etc).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { markMailSent } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(req: NextRequest, msg: string): Response {
  const referer = req.headers.get("referer");
  const fallback = new URL(`/admin?view=outreach&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url);
  // Bei Klick aus der Per-App-View bleiben wir dort
  if (referer && referer.includes("/admin?view=")) {
    const u = new URL(referer);
    u.searchParams.set("msg", msg.slice(0, 400));
    return NextResponse.redirect(u, 303);
  }
  return NextResponse.redirect(fallback, 303);
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
    const row = await markMailSent(id);
    return back(req, `Mail #${row.mails_sent} an @${row.handle}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `mark-mail failed: ${msg.slice(0, 120)}`);
  }
}
