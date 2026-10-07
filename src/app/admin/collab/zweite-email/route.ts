// POST /admin/collab/zweite-email — die Ausweichadresse eines Threads setzen.
//
// Der Fall: ein Creator wird auf der Adresse aus seiner Bio angeschrieben, dort
// liest niemand, und die zweite Anfrage verschwindet genauso. Irgendwo steht
// dann noch eine Management- oder Zweitadresse. Bisher landete die in der
// freien Notiz, wo sie niemand als Adresse erkennt und niemand nachschlägt.
//
// Eigene Route neben `collab/stage`, weil es eine eigene Tabelle ist: dort ist
// `stage` `not null`, und wer eine zweite Adresse einträgt, hat über den
// Fortschritt noch nichts gesagt (siehe Migration 0036).
//
// Bewusst NICHTS abgeleitet: die Route prüft nicht, ob wirklich schon zweimal
// geschrieben wurde. Das ist eine Anzeigefrage, und ein Server, der eine
// Eingabe wegen einer Zählung abweist, wäre im einen Fall, in dem Alain es
// besser weiss, nur im Weg.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { setCollabZweiteEmail } from "@/lib/collabStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin/collabs?msg=${encodeURIComponent(msg.slice(0, 300))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  // Der Auth-Gate der Seite reicht für die Anzeige, aber eine Route ist eine
  // eigene, direkt aufrufbare URL — sie prüft ihre Berechtigung selbst.
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Eingabe nicht lesbar");
  }

  const app = String(form.get("app") ?? "").trim();
  const contactKey = String(form.get("contact_key") ?? "").trim();
  if (!app || !contactKey) return back(req, "Thread fehlt");

  const adresse = String(form.get("zweite_email") ?? "");
  const quelle = String(form.get("quelle") ?? "");
  const res = await setCollabZweiteEmail(app, contactKey, adresse, quelle);
  revalidatePath("/admin/collabs");

  if (!res.ok) return back(req, `Speichern fehlgeschlagen (${res.error ?? "unbekannt"})`);
  return back(
    req,
    adresse.trim() ? `Zweite Adresse für ${contactKey} gespeichert` : `Zweite Adresse entfernt`,
  );
}
