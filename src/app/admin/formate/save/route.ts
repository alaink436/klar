// POST /admin/formate/save: ein Format ein- oder ausschalten (hoechstens 5 an).
// Schreibt in die Klar-Hub-Supabase, siehe src/lib/creatorKit.ts.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { setFormatActive } from "@/lib/creatorKit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;
  const form = await req.formData().catch(() => null);
  const res = form
    ? await setFormatActive(String(form.get("id") ?? ""), form.get("active") === "1")
    : { ok: false as const, msg: "Formular unlesbar" };
  revalidatePath("/admin/formate");
  const key = res.ok ? "msg" : "err";
  return NextResponse.redirect(new URL(`/admin/formate?${key}=${encodeURIComponent(res.msg)}`, req.url), 303);
}
