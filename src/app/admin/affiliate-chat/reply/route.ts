// POST /admin/affiliate-chat/reply — Alain replies to an affiliate's in-app
// chat. Appends an 'out' message and marks the affiliate's inbound messages
// read. Form-POST: affiliate_user_id, body. Returns JSON (the inbox composer
// calls it with ?json=1 and reads { ok, msg }).

import { type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { insertAffiliateMessage, markAffiliateThreadReadByAdmin } from "@/lib/affiliateChatStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY || !ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return json({ ok: false, msg: "unauthorized" }, 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, msg: "Bad form" }, 400);
  }

  const affiliateUserId = String(form.get("affiliate_user_id") ?? "").trim();
  if (!UUID_RE.test(affiliateUserId)) return json({ ok: false, msg: "Ungültige Affiliate-ID" }, 400);

  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return json({ ok: false, msg: "Nachricht darf nicht leer sein" }, 400);

  const msg = await insertAffiliateMessage(affiliateUserId, "out", body);
  if (!msg) return json({ ok: false, msg: "Speichern fehlgeschlagen" }, 502);

  await markAffiliateThreadReadByAdmin(affiliateUserId).catch(() => {});
  return json({ ok: true });
}
