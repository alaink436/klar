// Inbox-Decline (+ Reopen) endpoint. Sets klar_inquiries.status to 'declined'
// (plus declined_at / decline_reason) or reverts back to 'new'. Cookie-auth
// via KLAR_ADMIN_KEY, mirrors /admin/approve.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(req: NextRequest, msg: string, viewExtra = ""): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=inbox${viewExtra}&msg=${encodeURIComponent(msg.slice(0, 300))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY || !KLAR_INBOX_KEY) {
    return back(req, "Server misconfigured: KLAR_ADMIN_KEY / KLAR_INBOX_SERVICE_KEY fehlt.");
  }
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    const next = encodeURIComponent("/admin?view=inbox");
    return NextResponse.redirect(new URL(`/admin/login?next=${next}`, req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form.");
  }

  const inquiryId = String(form.get("inquiry_id") ?? "").trim();
  const action = String(form.get("action") ?? "decline").trim().toLowerCase();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 280);

  if (!inquiryId) return back(req, "missing inquiry_id");
  if (!UUID_RE.test(inquiryId)) return back(req, "invalid inquiry_id");
  if (action !== "decline" && action !== "reopen") return back(req, "unknown action");

  const patch =
    action === "decline"
      ? { status: "declined", declined_at: new Date().toISOString(), decline_reason: reason || null }
      : { status: "new", declined_at: null, decline_reason: null };

  let res: Response;
  try {
    res = await fetch(
      `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?id=eq.${encodeURIComponent(inquiryId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: KLAR_INBOX_KEY,
          Authorization: `Bearer ${KLAR_INBOX_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(patch),
      },
    );
  } catch (e) {
    return back(req, `Netzwerk-Fehler beim ${action}: ${String(e).slice(0, 120)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return back(req, `${action} fehlgeschlagen (${res.status}): ${body.slice(0, 160)}`);
  }

  const viewExtra = action === "decline" ? "" : "&show_declined=1";
  return back(
    req,
    action === "decline" ? "Anfrage abgelehnt." : "Anfrage wieder als neu markiert.",
    viewExtra,
  );
}
