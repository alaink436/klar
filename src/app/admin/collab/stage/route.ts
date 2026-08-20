// POST /admin/collab/stage — den Stand eines Collab-Gesprächs setzen.
//
// Das Board leitet aus den Nachrichten ab, WESSEN Zug es ist (offen /
// angeschrieben / beantwortet). Wie weit die Sache gediehen ist, steht
// nirgends: ein "beantwortet" kann heissen, dass der Deal steht, oder dass man
// einmal höflich abgesagt hat. Diese Route schreibt die zweite Achse — eine
// Stufe und eine freie Notiz pro Thread, beides von Hand.
//
// Bewusst nichts Abgeleitetes: es gibt keinen Automatismus, der eine Stufe
// weiterschaltet. Was hier steht, hat jemand hingeschrieben, und nur deshalb
// kann man sich darauf verlassen.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import {
  COLLAB_NOTE_MAX,
  COLLAB_STAGE_LABELS,
  isCollabStage,
  setCollabStage,
} from "@/lib/collabStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin/collabs?msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured: KLAR_ADMIN_KEY fehlt");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Formular unlesbar");
  }

  // Thread-Schlüssel kommt aus der Zeile, die der Knopf gerendert hat. Nicht
  // geprüft wird, ob es den Thread gibt: die Stand-Tabelle hat absichtlich
  // keinen Fremdschlüssel auf die Nachrichten (ein gelöschter Testthread soll
  // nicht den Stand mitreissen), und ein Eintrag ins Leere schadet niemandem.
  const app = String(form.get("app") ?? "").trim().toLowerCase();
  const contactKey = String(form.get("contact_key") ?? "").trim();
  if (!app || !contactKey) return back(req, "Thread fehlt");

  const rawStage = String(form.get("stage") ?? "").trim();
  if (!isCollabStage(rawStage)) return back(req, "Unbekannter Stand");

  const note = String(form.get("note") ?? "").trim().slice(0, COLLAB_NOTE_MAX);

  const res = await setCollabStage(app, contactKey, rawStage, note);
  if (!res.ok) return back(req, `Stand NICHT gespeichert (${res.error ?? "?"}).`);

  revalidatePath("/admin/collabs");
  const who = contactKey.includes(":") ? `@${contactKey.split(":")[1]}` : contactKey;
  return back(req, `${who}: ${COLLAB_STAGE_LABELS[rawStage]}${note ? " · Notiz gespeichert" : ""}.`);
}
