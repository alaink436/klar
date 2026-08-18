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

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import {
  COLLAB_ALIASES,
  collabAppOptions,
  collabContactKey,
  insertCollabMessage,
  isCollabChannel,
  type CollabChannel,
} from "@/lib/collabStore";

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
  return back(
    req,
    direction === "out"
      ? `Notiert: du hast ${who} geschrieben (${COLLAB_ALIASES[alias].name}).`
      : `Notiert: ${who} hat geschrieben (${COLLAB_ALIASES[alias].name}).`,
  );
}
