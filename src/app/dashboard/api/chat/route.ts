// Affiliate-facing chat API. GET lists the signed-in affiliate's thread, POST
// appends an inbound message (direction 'in'). Auth via the Supabase session;
// only linked affiliates may post. Alain reads + replies from the admin inbox.

import { getSessionUser } from "@/lib/supabaseAuth";
import { loadAffiliate } from "../../(app)/_shared/dashboard-data";
import { listAffiliateMessages, insertAffiliateMessage } from "@/lib/affiliateChatStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const messages = await listAffiliateMessages(user.id);
  return json({ ok: true, messages });
}

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const affiliate = await loadAffiliate(user.id);
  if (!affiliate) return json({ ok: false, error: "not_an_affiliate" }, 403);

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const body = String(b?.body ?? "").trim().slice(0, 4000);
  if (!body) return json({ ok: false, error: "empty" }, 400);

  const message = await insertAffiliateMessage(user.id, "in", body);
  if (!message) return json({ ok: false, error: "store_failed" }, 502);
  return json({ ok: true, message });
}
