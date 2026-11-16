// POST /admin/conversion/aenderung: add a line to an app's change log, or remove one (`remove` = its id).
// Writes to the Klar-Hub Supabase, see src/lib/appChanges.ts. Back to the page with the message.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { addAppChange, removeAppChange } from "@/lib/appChanges";
import { CONVERSION_APPS } from "@/lib/posthog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;
  const form = await req.formData().catch(() => null);
  const app = String(form?.get("app") ?? "");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  const res = !form
    ? { ok: false as const, msg: "Formular unlesbar" }
    : form.has("remove")
      ? await removeAppChange(String(form.get("remove")))
      : await addAppChange(app, CONVERSION_APPS.map((a) => a.slug), String(form.get("day") ?? ""), String(form.get("text") ?? ""), today);
  revalidatePath("/admin/conversion");
  // Back to the page as it was (app, filters); only our own query keys go along.
  const back = new URL("/admin/conversion", req.url);
  const from = new URL(req.headers.get("referer") ?? req.url);
  for (const k of ["app", "os", "tage", "takt"]) {
    const v = from.searchParams.get(k);
    if (v) back.searchParams.set(k, v);
  }
  if (!res.ok) back.searchParams.set("err", res.msg);
  return NextResponse.redirect(back, 303);
}
