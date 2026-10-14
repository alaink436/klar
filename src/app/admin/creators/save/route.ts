// POST /admin/creators/save: einen Creator anlegen (action=add) oder entfernen
// (action=remove). Schreibt in die Supabase der App, siehe src/lib/creators.ts.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { addCreator, removeCreator } from "@/lib/creators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(req: NextRequest, key: "msg" | "err", text: string): Response {
  return NextResponse.redirect(
    new URL(`/admin/creators?${key}=${encodeURIComponent(text.slice(0, 400))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "err", "Formular unlesbar");
  }

  const action = String(form.get("action") ?? "");
  const app = String(form.get("app") ?? "");
  const handle = String(form.get("handle") ?? "");

  const res =
    action === "add"
      ? await addCreator(app, String(form.get("name") ?? ""), handle)
      : action === "remove"
        ? await removeCreator(app, handle)
        : { ok: false as const, msg: "Unbekannte Aktion" };

  revalidatePath("/admin/creators");
  return back(req, res.ok ? "msg" : "err", res.msg);
}
