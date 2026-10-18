// POST /admin/inbox/delete — delete one website request (Bewerbung) from the inbox.
// JSON body { id } (klar_inquiries uuid) -> { ok } | { ok:false, error }.
// "Delete" moves the whole row to klar_inbox_archiv first, as the clean-out of
// 2026-10-17 did; back with jsonb_populate_record. Admin session like every admin route.

import { type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/adminGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const hdr = {
  apikey: KLAR_INBOX_KEY,
  Authorization: `Bearer ${KLAR_INBOX_KEY}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req);
  if (!auth.ok) return auth.response;
  if (!KLAR_INBOX_KEY) return json({ ok: false, error: "KLAR_INBOX_SERVICE_KEY fehlt" }, 500);

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "bad json" }, 400);
  }
  const id = String(b.id ?? "").trim();
  if (!UUID_RE.test(id)) return json({ ok: false, error: "id ungültig" }, 400);

  const row = `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?id=eq.${id}`;
  try {
    const got = await fetch(`${row}&select=*`, { headers: hdr, cache: "no-store" });
    if (!got.ok) return json({ ok: false, error: `lesen ${got.status}` }, 502);
    const [zeile] = (await got.json()) as Record<string, unknown>[];
    // Already gone (other tab, second click): nothing left to delete.
    if (!zeile) return json({ ok: true });

    const arch = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_inbox_archiv`, {
      method: "POST",
      headers: { ...hdr, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ quelle: "klar_inquiries", id, zeile }),
    });
    if (!arch.ok) return json({ ok: false, error: `archivieren ${arch.status}` }, 502);

    const del = await fetch(row, { method: "DELETE", headers: { ...hdr, Prefer: "return=minimal" } });
    if (!del.ok) return json({ ok: false, error: `löschen ${del.status}` }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "delete failed" }, 502);
  }
}
