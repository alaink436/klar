// POST /admin/vault/tiktok/reveal — decrypted password of one TikTok account,
// for the logged-in admin's browser only. Same gate and rate limit as
// /admin/vault/reveal; the password travels only in the no-store JSON body.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/adminGuard";
import { revealTiktokPassword } from "@/lib/tiktokAccounts";
import { clientIp, rateLimit } from "@/lib/apiGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req);
  if (!auth.ok) return auth.response;

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
