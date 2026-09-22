// POST /admin/feedback/aktion — Feedback abhaken oder wieder oeffnen.

import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/app/admin/_shared";
import { setFeedbackDone } from "@/lib/feedbackStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await checkAuth(req);
  if (!auth.authed) return NextResponse.redirect(new URL("/admin/login", req.url), 303);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(new URL("/admin/feedback?stand=fehler&msg=Kein+Formular", req.url), 303);
  }
  const feld = (name: string, max: number) => String(form.get(name) ?? "").slice(0, max);
  const erledigt = feld("erledigt", 1) === "1";
  const ok = await setFeedbackDone(feld("id", 40), erledigt);

  // Zurueck in denselben Ordner, ohne den Eintrag: er steht dort nicht mehr.
  const q = new URLSearchParams();
  if (feld("ordner", 10) === "erledigt") q.set("ordner", "erledigt");
  const app = feld("app", 40);
  if (app) q.set("app", app);
  if (!ok) {
    q.set("stand", "fehler");
    q.set("msg", "Konnte nicht gespeichert werden.");
  }
  const s = q.toString();
  return NextResponse.redirect(new URL(s ? `/admin/feedback?${s}` : "/admin/feedback", req.url), 303);
}
