// POST /admin/auszahlung/save: Alain gibt die Auszahlung eines Creators frei,
// die App legt sie in Wise an. Siehe src/lib/payouts.ts.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { approvePayout } from "@/lib/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;
  const form = await req.formData().catch(() => null);
  const creator = String(form?.get("creator") ?? "");
  const res = /^[0-9a-f-]{36}$/.test(creator) ? await approvePayout(creator) : { ok: false as const, msg: "Unbekannter Creator" };
  revalidatePath("/admin/auszahlung");
  const key = res.ok ? "msg" : "err";
  return NextResponse.redirect(new URL(`/admin/auszahlung?${key}=${encodeURIComponent(res.msg)}`, req.url), 303);
}
