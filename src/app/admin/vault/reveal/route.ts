// POST /admin/vault/reveal — returns the decrypted plaintext of one vault key
// to the logged-in admin's browser, on demand. Admin-session + device-cookie
// gated (same as the rest of the vault). The key is returned only in the JSON
// body (never a URL), with no-store; it is never logged.
//
// This is intentionally a human-only escape hatch: it makes "admin access = key
// access". The agent never calls this (no admin cookies), and VAULT_MASTER_KEY
// lives only in the server env, so the agent still cannot read keys.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { revealSecret } from "@/lib/vault";
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

  // Light brake against accidental loops / scripted dumping.
  const rl = rateLimit("vault_reveal", clientIp(req), 60, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  let id = "";
  try {
    const form = await req.formData();
    id = String(form.get("id") ?? "").trim();
  } catch {
    try {
      const body = (await req.json()) as { id?: string };
      id = String(body?.id ?? "").trim();
    } catch {
      /* ignore */
    }
  }
  if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });

  const key = await revealSecret(id);
  if (key === null) return NextResponse.json({ error: "not found or vault not configured" }, { status: 404 });

  return new NextResponse(JSON.stringify({ key }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
