// POST handler for the API-key Vault management page (/admin/vault).
//   action=add     -> encrypt + store a secret (raw key entered by the user;
//                     encrypted server-side, never logged or echoed)
//   action=rotate  -> replace a secret's key in place (same id / proxy URL)
//   action=edit    -> update a secret's metadata (label / provider / category /
//                     base_url / auth) in place; the stored key is untouched
//   action=delete  -> remove a secret by id
//
// Same admin auth as /admin/settings/save (device cookie + admin session).

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { addSecret, deleteSecret, rotateSecret, updateSecretMeta } from "@/lib/vault";
import { packAscKey } from "@/lib/ascJwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// App Store Connect keys are three fields, not one: issuer id, key id and the
// .p8 file. The form posts them separately (key_kind=asc) and they are packed
// into a single JSON blob here, which the vault then encrypts like any other
// secret. packAscKey() test-signs the key, so a broken .p8 fails now instead of
// as an unexplained 401 from Apple weeks later.
function readSecret(form: FormData): { secret: string } | { error: string } {
  if (String(form.get("key_kind") ?? "").trim() !== "asc") {
    return { secret: String(form.get("secret") ?? "") };
  }
  try {
    return {
      secret: packAscKey({
        issuerId: String(form.get("asc_issuer_id") ?? ""),
        keyId: String(form.get("asc_key_id") ?? ""),
        p8: String(form.get("asc_p8") ?? ""),
        sub: String(form.get("asc_sub") ?? ""),
      }),
    };
  } catch {
    return { error: "asc-bad-key" };
  }
}

// msg/err carry a CODE, not prose: /admin/vault renders it through
// flashText() in the admin UI language (see ../_i18n). Anything that is not a
// known code (e.g. a technical string from lib/vault) is shown verbatim.
function backWith(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/vault", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/vault", req.url), 303);
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/vault", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return backWith(req, { err: "bad-form" });
  }

  const action = String(form.get("action") ?? "").trim();

  if (action === "delete") {
    const id = String(form.get("id") ?? "").trim();
    if (!id) return backWith(req, { err: "no-entry" });
    const ok = await deleteSecret(id);
    return backWith(req, ok ? { msg: "deleted" } : { err: "delete-failed" });
  }

  if (action === "rotate") {
    const id = String(form.get("id") ?? "").trim();
    const read = readSecret(form);
    if ("error" in read) return backWith(req, { err: read.error });
    const secret = read.secret;
    if (!id) return backWith(req, { err: "no-entry" });
    if (!secret) return backWith(req, { err: "no-new-key" });
    const r = await rotateSecret(id, secret);
    return backWith(req, r.ok ? { msg: "rotated" } : { err: r.error });
  }

  if (action === "edit") {
    const id = String(form.get("id") ?? "").trim();
    if (!id) return backWith(req, { err: "no-entry" });
    const label = String(form.get("label") ?? "").trim();
    const provider = String(form.get("provider") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const base_url = String(form.get("base_url") ?? "").trim();
    const auth_header = String(form.get("auth_header") ?? "authorization").trim();
    const auth_scheme = String(form.get("auth_scheme") ?? "Bearer ");
    const r = await updateSecretMeta(id, { label, provider, category, base_url, auth_header, auth_scheme });
    return backWith(req, r.ok ? { msg: "updated" } : { err: r.error });
  }

  if (action === "add") {
    const label = String(form.get("label") ?? "").trim();
    const provider = String(form.get("provider") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const base_url = String(form.get("base_url") ?? "").trim();
    const auth_header = String(form.get("auth_header") ?? "authorization").trim();
    const auth_scheme = String(form.get("auth_scheme") ?? "Bearer ");
    const auth_in = String(form.get("auth_in") ?? "header").trim() === "query" ? "query" : "header";
    const read = readSecret(form);
    if ("error" in read) return backWith(req, { err: read.error });
    const secret = read.secret;
    if (!secret) return backWith(req, { err: "no-key" });
    // base_url is optional: omit it for a store-only secret (reveal only, no proxy).
    const r = await addSecret({ label, provider, category, base_url, auth_header, auth_scheme, auth_in, secret });
    return backWith(req, r.ok ? { msg: "saved" } : { err: r.error });
  }

  return backWith(req, { err: "unknown-action" });
}
