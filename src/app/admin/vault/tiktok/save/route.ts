// POST handler for /admin/vault/tiktok.
//   action=add    -> store a TikTok login (password sealed server-side)
//   action=edit   -> update it in place; an empty password field keeps the old one
//   action=delete -> remove it
//
// Same admin auth as /admin/vault/save (device cookie + admin session).

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
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
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL(`/admin/login?next=${PAGE}`, req.url), 303);
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) return NextResponse.redirect(new URL(`/admin/login?next=${PAGE}`, req.url), 303);

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
