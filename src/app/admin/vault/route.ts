// POST handler for the API-key Vault.
//   action=add     -> encrypt + store a secret (the raw key is entered by the
//                     user in the form; it is encrypted server-side and never
//                     logged or echoed back)
//   action=delete  -> remove a secret by id
//
// Same admin auth as /admin/settings/save (device cookie + admin session).

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { addSecret, deleteSecret } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backWith(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/settings", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/settings", req.url), 303);
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/settings", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return backWith(req, { err: "bad form" });
  }

  const action = String(form.get("action") ?? "").trim();

  if (action === "delete") {
    const id = String(form.get("id") ?? "").trim();
    if (!id) return backWith(req, { err: "kein Eintrag angegeben" });
    const ok = await deleteSecret(id);
    return backWith(req, ok ? { msg: "Vault-Key gelöscht." } : { err: "Löschen fehlgeschlagen." });
  }

  if (action === "add") {
    const label = String(form.get("label") ?? "").trim();
    const provider = String(form.get("provider") ?? "").trim();
    const base_url = String(form.get("base_url") ?? "").trim();
    const auth_header = String(form.get("auth_header") ?? "authorization").trim();
    const auth_scheme = String(form.get("auth_scheme") ?? "Bearer ");
    const secret = String(form.get("secret") ?? "");
    if (!secret) return backWith(req, { err: "Kein Key angegeben." });
    if (!base_url) return backWith(req, { err: "Keine Base-URL angegeben." });
    const r = await addSecret({ label, provider, base_url, auth_header, auth_scheme, secret });
    return backWith(req, r.ok ? { msg: "Vault-Key gespeichert (verschlüsselt)." } : { err: r.error });
  }

  return backWith(req, { err: `unbekannte Aktion: ${action || "(leer)"}` });
}
