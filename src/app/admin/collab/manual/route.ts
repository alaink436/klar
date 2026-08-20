// POST /admin/collab/manual — ein Collab-Gespräch von Hand erfassen.
//
// Der Rest des Collab-Boards füllt sich von selbst: Brevo-Inbound schreibt
// eingehende Mails an die Bio-Adressen, /admin/collab/reply die Antworten.
// Wer Influencer aber selbst anschreibt (Instagram-DM, TikTok-DM, Mail aus dem
// eigenen Postfach), hatte bisher keinen Ort dafür. Diese Route legt genau
// solche Nachrichten in derselben Tabelle ab, mit manual=true und dem Kanal.
//
// Bewusst NUR ein Log-Eintrag: hier wird nichts verschickt. Was rausgeht, geht
// über /admin/collab/reply (Mail via Brevo) — eine DM kann diese App nicht
// senden, und so zu tun als ob wäre schlimmer als das Feld leer zu lassen.
//
// Auf Wunsch legt das Formular zusätzlich einen Punkt in der To-do-Liste an
// ("Nachfassen: @handle (App)"). Bewusst als Haken und nicht abgeleitet: die
// To-do-Liste ist die Liste der selbst gefassten Vorsätze (siehe Kopf von
// lib/todoStore), abgeleitete Arbeit steht in der Arbeitsliste auf
// /admin/overview. Wer nachfassen will, sagt es hier einmal.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import {
  COLLAB_ALIASES,
  COLLAB_NOTE_MAX,
  COLLAB_STAGE_LABELS,
  collabAppOptions,
  collabContactKey,
  insertCollabMessage,
  isCollabChannel,
  isCollabStage,
  setCollabStage,
  type CollabChannel,
} from "@/lib/collabStore";
import { addTodo } from "@/lib/todoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_RE = /^[A-Za-z0-9_.\-]{1,64}$/;
const BODY_MAX = 8000;
const SUBJECT_MAX = 300;

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

  const app = String(form.get("app") ?? "").trim().toLowerCase();
  const alias = collabAppOptions().find((o) => o.app === app)?.alias;
  if (!alias || !COLLAB_ALIASES[alias]) return back(req, "Unbekannte App");

  const rawChannel = String(form.get("channel") ?? "").trim().toLowerCase();
  if (!isCollabChannel(rawChannel)) return back(req, "Unbekannter Kanal");
  const channel: CollabChannel = rawChannel;

  const direction = String(form.get("direction") ?? "").trim();
  if (direction !== "in" && direction !== "out") return back(req, "Richtung fehlt");

  // Identität: bei Mail die Adresse, sonst der Handle. Beides zusammen ist
  // erlaubt (DM-Kontakt, dessen Mail man kennt) — der Thread-Key richtet sich
  // nach dem Kanal, damit derselbe Mensch nicht in zwei Threads zerfällt.
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const handle = String(form.get("handle") ?? "").trim().replace(/^@/, "");
  if (channel === "email") {
    if (!EMAIL_RE.test(email)) return back(req, "Für den Kanal E-Mail braucht es eine gültige Adresse");
  } else {
    if (!handle) return back(req, "Handle fehlt");
    if (!HANDLE_RE.test(handle)) return back(req, "Handle ungültig (nur Buchstaben, Zahlen, . _ -)");
    if (email && !EMAIL_RE.test(email)) return back(req, "E-Mail ungültig");
  }
  const contactKey = collabContactKey(channel, channel === "email" ? email : handle);

  const contactName = String(form.get("contact_name") ?? "").trim().slice(0, 120) || null;
  const subject = String(form.get("subject") ?? "").trim().slice(0, SUBJECT_MAX) || null;
  const body = String(form.get("body") ?? "").trim();
  if (!body) return back(req, "Nachricht/Notiz fehlt");

  // Zeitpunkt: das Formular schickt ISO mit Zone (im Browser umgerechnet).
  // Ungültiges oder zukünftiges Datum → jetzt, statt die Sortierung zu kippen.
  const rawAt = String(form.get("at") ?? "").trim();
  let at: string | null = null;
  if (rawAt) {
    const d = new Date(rawAt);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 60_000) at = d.toISOString();
  }

  const row = await insertCollabMessage({
    app,
    alias,
    contact_email: contactKey,
    contact_name: contactName ?? (channel === "email" ? null : handle),
    direction,
    subject,
    body: body.slice(0, BODY_MAX),
    provider: "manual",
    channel,
    contact_handle: channel === "email" ? null : handle,
    manual: true,
    sent_at: at,
    created_at: at,
  });
  if (!row) return back(req, "Eintrag NICHT gespeichert (Supabase-Key fehlt oder Insert abgelehnt)");

  const who = channel === "email" ? email : `@${handle}`;
  const appName = COLLAB_ALIASES[alias].name;
  let noted =
    direction === "out"
      ? `Notiert: du hast ${who} geschrieben (${appName}).`
      : `Notiert: ${who} hat geschrieben (${appName}).`;

  // Stand ist optional und hat KEINE Vorauswahl: ein Nachtrag zu einem
  // laufenden Gespräch soll dessen Stufe nicht stillschweigend zurückdrehen.
  // Leer heisst darum "unverändert lassen", nicht "auf Anfang".
  const rawStage = String(form.get("stage") ?? "").trim();
  if (rawStage && isCollabStage(rawStage)) {
    const stageNote = String(form.get("stage_note") ?? "").trim().slice(0, COLLAB_NOTE_MAX);
    const st = await setCollabStage(app, contactKey, rawStage, stageNote);
    noted += st.ok
      ? ` Stand: ${COLLAB_STAGE_LABELS[rawStage]}.`
      : ` ⚠️ Stand NICHT gesetzt (${st.error ?? "?"}).`;
  }

  // Optionaler To-do-Punkt. Der Collab-Eintrag steht bereits — ein Fehler beim
  // To-do darf ihn nicht zurücknehmen, er wird nur gemeldet.
  if (String(form.get("todo") ?? "") !== "1") return back(req, noted);

  const rawDue = String(form.get("todo_due") ?? "").trim();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? rawDue : null;
  const title = `${direction === "out" ? "Nachfassen" : "Antworten"}: ${who} (${appName})`;
  const todo = await addTodo(title, due);
  if (!todo.ok) return back(req, `${noted} ⚠️ To-do NICHT angelegt (${todo.error ?? "?"}).`);
  revalidatePath("/admin/todos");
  revalidatePath("/admin/overview");
  return back(req, `${noted} To-do „${title}“${due ? ` für ${due}` : ""} angelegt.`);
}
