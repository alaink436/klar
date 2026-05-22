// POST /admin/outreach/update — Status-Transition (dm_sent | replied | ...).
// Setzt zusätzlich Notes/Last-Message wenn übergeben.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { setOutreachStatus } from "../../../../lib/outreachStore";
import type { OutreachStatus } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: OutreachStatus[] = [
  "queued", "dm_sent", "replied", "declined", "converted", "dead",
];
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

  const status = String(form.get("status") ?? "").trim() as OutreachStatus;
  if (!VALID_STATUSES.includes(status)) return back(req, "status ungültig");

  const notes = form.has("notes") ? String(form.get("notes") ?? "") : undefined;
  const lastMessage = form.has("last_message") ? String(form.get("last_message") ?? "") : undefined;

  try {
    const row = await setOutreachStatus(id, status, {
      notes: notes,
      last_message: lastMessage,
    });
    return back(req, `@${row.handle}: → ${row.status}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Update fehlgeschlagen: ${msg.slice(0, 120)}`);
  }
}
