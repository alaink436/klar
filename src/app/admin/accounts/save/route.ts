// POST handler for /admin/accounts.
//   action=add       -> new account row (password optional, goes to the vault)
//   action=edit      -> update an account's fields
//   action=password  -> set or replace the password (vault secret, encrypted)
//   action=delete    -> remove the account and its vault secret
//
// Same admin auth as /admin/vault/save (admin session + device cookie). The
// password is read from the form and handed straight to lib/vault; it is never
// logged, echoed or put in a redirect URL.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import {
  addAccount,
  deleteAccount,
  setAccountPassword,
  updateAccount,
  type AccountFields,
} from "@/lib/socialAccountsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backWith(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/accounts", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

function fields(form: FormData): AccountFields {
  const s = (k: string) => String(form.get(k) ?? "");
  return {
    app: s("app"),
    platform: s("platform"),
    handle: s("handle"),
    display_name: s("display_name"),
    role: s("role"),
    status: s("status"),
    login_email: s("login_email"),
    notes: s("notes"),
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  const login = new URL("/admin/login?next=/admin/accounts", req.url);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) return NextResponse.redirect(login, 303);
  if (!(await verifyDeviceCookie(readCookie(req, "klar_device"), DEV))) return NextResponse.redirect(login, 303);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return backWith(req, { err: "bad-form" });
  }
  const action = String(form.get("action") ?? "").trim();
  const id = String(form.get("id") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (action === "add") {
    const newId = await addAccount(fields(form));
    if (!newId) return backWith(req, { err: "save-failed" });
    if (password && !(await setAccountPassword(newId, password))) return backWith(req, { err: "password-failed" });
    return backWith(req, { msg: "account-saved" });
  }
  if (!id) return backWith(req, { err: "no-entry" });
  if (action === "edit") {
    const ok = await updateAccount(id, fields(form));
    if (ok && password && !(await setAccountPassword(id, password))) return backWith(req, { err: "password-failed" });
    return backWith(req, ok ? { msg: "account-saved" } : { err: "save-failed" });
  }
  if (action === "password") {
    const ok = await setAccountPassword(id, password);
    return backWith(req, ok ? { msg: "account-saved" } : { err: "password-failed" });
  }
  if (action === "delete") {
    const ok = await deleteAccount(id);
    return backWith(req, ok ? { msg: "account-deleted" } : { err: "delete-failed" });
  }
  return backWith(req, { err: "bad-form" });
}
