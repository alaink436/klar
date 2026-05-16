// Triggers a connected app's wise-reconcile (poll Wise transfer status ->
// paid/failed + batch status). Cookie-auth via KLAR_ADMIN_KEY. Redirects to /admin.

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
  try {
    const f = await req.formData();
    slug = String(f.get("app") ?? "");
  } catch {
    return back("Bad form data.");
  }
  const app = getApp(slug);
  if (!app) return back(`Unknown app: ${slug}`);

  try {
    const r = await fetch(`${app.functionsBase}/wise-reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": app.adminKey },
      body: "{}",
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return back(`${app.name}: Reconcile fehlgeschlagen (${r.status}): ${j?.error ?? "unknown"}`);
    return back(`${app.name} Reconcile: ${j?.checked ?? 0} gepr&uuml;ft, ${j?.paid ?? 0} bezahlt, ${j?.failed ?? 0} fehlgeschlagen.`);
  } catch (e) {
    return back(`${app.name}: Reconcile-Fehler: ${String(e).slice(0, 200)}`);
  }
}
