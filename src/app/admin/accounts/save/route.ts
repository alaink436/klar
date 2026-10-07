// POST handler for /admin/accounts.
//   action=add       -> new account row (password optional, goes to the vault)
//   action=edit      -> update an account's fields
//   action=password  -> set or replace the password (vault secret, encrypted)
//   action=delete    -> remove the account and its vault secret
//   action=delete-app -> remove every account of one app (apps that are gone)
//
// Same admin auth as /admin/vault/save (admin session + device cookie). The
// password is read from the form and handed straight to lib/vault; it is never
// logged, echoed or put in a redirect URL.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/adminGuard";
import {
  addAccount,
  deleteAccount,
  deleteApp,
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
    blotato_id: s("blotato_id"),
    notes: s("notes"),
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;

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
  if (action === "delete-app") {
    const n = await deleteApp(String(form.get("app") ?? "").trim());
    return backWith(req, n === null ? { err: "delete-failed" } : { msg: "account-deleted" });
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
