// POST /admin/vault/tiktok/reveal — decrypted password of one TikTok account,
// for the logged-in admin's browser only. Same gate and rate limit as
// /admin/vault/reveal; the password travels only in the no-store JSON body.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { revealTiktokPassword } from "@/lib/tiktokAccounts";
import { clientIp, rateLimit } from "@/lib/apiGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return NextResponse.json({ error: "admin not configured" }, { status: 503 });
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = rateLimit("vault_reveal", clientIp(req), 60, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  let id = "";
  try {
    const form = await req.formData();
    id = String(form.get("id") ?? "").trim();
  } catch {
    /* ignore */
  }
  if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });

  const password = await revealTiktokPassword(id);
  if (password === null) return NextResponse.json({ error: "not found or vault not configured" }, { status: 404 });

  return new NextResponse(JSON.stringify({ password }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
