// POST /admin/inbox/star — toggle the star on one inbox conversation.
// JSON body { id, on } -> { ok } | { ok:false, error }. Backs the optimistic
// star buttons in MailClient; admin-cookie auth like reply-templates/api.

import { type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { setStarred } from "../../../../lib/inboxStars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_MAX = 80;
const ID_RE = /^[a-z0-9-]+$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY || !ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }

  const id = String(b.id ?? "").trim();
  if (!id || id.length > ID_MAX || !ID_RE.test(id)) {
    return json({ ok: false, error: "id ungültig" }, 400);
  }
  const on = Boolean(b.on);

  try {
    await setStarred(id, on);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "star failed" }, 502);
  }
}
