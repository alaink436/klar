// Bulk-dispatch every awaiting_release batch across every wired-up app.
// Iterates per app: list their awaiting_release batches → POST wise-dispatch
// for each. Aggregates outcomes into one flash message and redirects back.
//
// Per-app failure does not abort the others; the flash counts successes,
// failures, and apps without ready batches separately.

import { getApps, sbGet, type AdminApp } from "../../../lib/adminApps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KLAR_ADMIN_KEY = process.env.KLAR_ADMIN_KEY ?? "";

function ctEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}
function readCookie(req: Request, name: string): string {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}
function back(msg: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/admin?view=payouts&msg=${encodeURIComponent(msg.slice(0, 600))}`,
    },
  });
}

interface BatchHead {
  id: string | number;
  status: string;
}

async function dispatchOne(
  app: AdminApp,
  batchId: string | number,
): Promise<{ ok: boolean; prepared?: number; total?: number; error?: string }> {
  try {
    const r = await fetch(`${app.functionsBase}/wise-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": app.adminKey },
      body: JSON.stringify({ batch_id: batchId }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: String(j?.error ?? r.status) };
    return { ok: true, prepared: Number(j?.prepared ?? 0), total: Number(j?.total_items ?? 0) };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!KLAR_ADMIN_KEY) return back("Server misconfigured: KLAR_ADMIN_KEY not set.");
  if (!ctEqual(readCookie(req, "klar_admin"), KLAR_ADMIN_KEY)) {
    return new Response(null, { status: 303, headers: { Location: "/admin" } });
  }

  const apps = getApps();
  if (apps.length === 0) return back("Keine Apps verdrahtet.");

  let dispatched = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const app of apps) {
    const batches = (await sbGet(
      app,
      "influencer_payout_batches?select=id,status&status=eq.awaiting_release&order=created_at.desc&limit=24",
    )) as BatchHead[];
    if (!batches.length) continue;
    for (const b of batches) {
      const r = await dispatchOne(app, b.id);
      if (r.ok) {
        dispatched++;
      } else {
        failed++;
        failures.push(`${app.name} #${b.id}: ${r.error ?? "unknown"}`);
      }
    }
  }

  if (dispatched === 0 && failed === 0) {
    return back("Keine bereiten Batches gefunden.");
  }
  const msg =
    failed === 0
      ? `${dispatched} Batches via Wise vorbereitet. Jetzt in Wise funden.`
      : `${dispatched} vorbereitet, ${failed} fehlgeschlagen: ${failures.slice(0, 3).join(" · ")}${failures.length > 3 ? " · …" : ""}`;
  return back(msg);
}
