// POST /admin/creators/save: Creator anlegen oder entfernen, App anlegen,
// bearbeiten oder entfernen. Schreibt in die Klar-Hub-Supabase, siehe
// src/lib/creators.ts.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { addCreator, removeApp, removeCreator, saveApp, type CreatorWrite } from "@/lib/creators";

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
  const get = (k: string) => String(form.get(k) ?? "");

  let res: CreatorWrite;
  switch (get("action")) {
    case "add":
      res = await addCreator(get("app"), get("name"), get("handle"));
      break;
    case "remove":
      res = await removeCreator(get("app"), get("handle"));
      break;
    case "app-save":
      res = await saveApp({
        slug: get("slug") || undefined,
        name: get("name"),
        shortPath: get("short_path"),
        detourLink: get("detour_link"),
        storeUrl: get("store_url"),
      });
      break;
    case "app-remove":
      res = await removeApp(get("slug"));
      break;
    default:
      res = { ok: false, msg: "Unbekannte Aktion" };
  }

  revalidatePath("/admin/creators");
  return back(req, res.ok ? "msg" : "err", res.msg);
}
