// POST /admin/routinen/save: a routine on or off, one posting time on or off, or its credit budget one up or down.
// Every click saves at once (the chips are the switches). Writes to the Klar-Hub Supabase, see src/lib/routines.ts.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { setRoutineActive, stepCredits, toggleSlot } from "@/lib/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;
  const form = await req.formData().catch(() => null);
  const app = String(form?.get("app") ?? "");
  const res = !form
    ? { ok: false as const, msg: "Formular unlesbar" }
    : form.has("slot")
      ? await toggleSlot(app, String(form.get("slot")))
      : form.has("credits")
        ? await stepCredits(app, form.get("credits") === "-1" ? -1 : 1)
        : await setRoutineActive(app, form.get("active") === "1");
  revalidatePath("/admin/routinen");
  const key = res.ok ? "msg" : "err";
  return NextResponse.redirect(new URL(`/admin/routinen?${key}=${encodeURIComponent(res.msg)}`, req.url), 303);
}
