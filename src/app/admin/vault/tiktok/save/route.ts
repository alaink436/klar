// POST handler for /admin/vault/tiktok.
//   action=add    -> store a TikTok login (password sealed server-side)
//   action=edit   -> update it in place; an empty password field keeps the old one
//   action=delete -> remove it
//
// Same admin auth as /admin/vault/save (device cookie + admin session).

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/adminGuard";
import {
  addTiktokAccount,
  deleteTiktokAccount,
  updateTiktokAccount,
  type TiktokAccountInput,
} from "@/lib/tiktokAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = "/admin/vault/tiktok";

function backWith(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL(PAGE, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

function readInput(form: FormData): TiktokAccountInput {
  return {
    channel: String(form.get("channel") ?? ""),
    username: String(form.get("username") ?? ""),
    email: String(form.get("email") ?? ""),
    note: String(form.get("note") ?? ""),
    password: String(form.get("password") ?? ""),
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

  if (action === "delete") {
    if (!id) return backWith(req, { err: "no-entry" });
    const ok = await deleteTiktokAccount(id);
    return backWith(req, ok ? { msg: "deleted" } : { err: "delete-failed" });
  }

  if (action === "edit") {
    if (!id) return backWith(req, { err: "no-entry" });
    const r = await updateTiktokAccount(id, readInput(form));
    return backWith(req, r.ok ? { msg: "updated" } : { err: r.error });
  }

  if (action === "add") {
    const r = await addTiktokAccount(readInput(form));
    return backWith(req, r.ok ? { msg: "saved" } : { err: r.error });
  }

  return backWith(req, { err: "unknown-action" });
}
