// Triggers a connected app's wise-dispatch for a batch. Cookie-auth via
// KLAR_ADMIN_KEY; the per-app x-admin-key comes from the registry, never
// from the client. Redirects back to /admin.

import { getApp } from "../../../lib/adminApps";

export const dynamic = "force-dynamic";

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
    headers: { Location: `/admin?msg=${encodeURIComponent(msg.slice(0, 300))}` },
  });
}

export async function POST(req: Request): Promise<Response> {
  if (!KLAR_ADMIN_KEY) return back("Server misconfigured: KLAR_ADMIN_KEY not set.");
  if (!ctEqual(readCookie(req, "klar_admin"), KLAR_ADMIN_KEY)) {
    return new Response(null, { status: 303, headers: { Location: "/admin" } });
  }
  let slug = "";
  let batchId = "";
  try {
    const f = await req.formData();
    slug = String(f.get("app") ?? "");
    batchId = String(f.get("batch_id") ?? "");
  } catch {
    return back("Bad form data.");
  }
  const app = getApp(slug);
  if (!app) return back(`Unknown app: ${slug}`);
  if (!batchId) return back("batch_id missing.");

  try {
    const r = await fetch(`${app.functionsBase}/wise-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": app.adminKey },
      body: JSON.stringify({ batch_id: batchId }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return back(`${app.name}: Dispatch fehlgeschlagen (${r.status}): ${j?.error ?? "unknown"}`);
    return back(`${app.name} Batch ${batchId}: ${j?.prepared ?? 0}/${j?.total_items ?? 0} via Wise vorbereitet. Jetzt in Wise funden.`);
  } catch (e) {
    return back(`${app.name}: Dispatch-Fehler: ${String(e).slice(0, 200)}`);
  }
}
