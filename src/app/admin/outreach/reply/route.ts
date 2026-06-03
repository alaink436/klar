// POST /admin/outreach/reply — schickt eine frei verfasste Antwort (aus einer
// der Vorlagen oder selbst getippt) per Brevo an die contact_email des Targets.
//
// WICHTIG: Eine Antwort ändert den Status NICHT. Das Target bleibt `replied`.
// Nur weil man zurückschreibt, ist der Influencer noch kein Affiliate — das
// passiert erst über die explizite "Als Affiliate annehmen"-Aktion
// (/admin/outreach/accept). Hier wird lediglich der mails_sent-Zähler erhöht.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { markMailSent } from "@/lib/outreachStore";
import { sendBrevoEmail, klarEmailShell } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function back(req: NextRequest, msg: string): Response {
  // Bleibt in der Outreach-View; preserve view param falls vorhanden.
  let view = "?view=outreach";
  try {
    const ref = req.headers.get("referer");
    if (ref) {
      const v = new URL(ref).searchParams.get("view");
      if (v) view = `?view=${encodeURIComponent(v)}`;
    }
  } catch {
    /* default view */
  }
  return NextResponse.redirect(
    new URL(`/admin${view}&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form");
  }

  const id = String(form.get("id") ?? "").trim();
  const to = String(form.get("to") ?? "").trim().toLowerCase();
  const subject = String(form.get("subject") ?? "").trim();
  const bodyText = String(form.get("body") ?? "").trim();

  if (!UUID_RE.test(id)) return back(req, "id ungültig");
  if (!EMAIL_RE.test(to)) return back(req, "Empfänger-Email ungültig");
  if (!subject) return back(req, "Betreff fehlt");
  if (!bodyText) return back(req, "Nachricht fehlt");

  const mail = await sendBrevoEmail({
    to,
    subject: subject.slice(0, 300),
    html: klarEmailShell(bodyText.slice(0, 8000)),
    tags: ["outreach-reply"],
  });
  if (!mail.sent) return back(req, `Mail NICHT gesendet (${mail.error ?? "?"})`);

  // mails_sent hochzählen (best-effort, Status bleibt replied).
  try {
    await markMailSent(id);
  } catch {
    /* Zähler ist observational, nicht kritisch */
  }

  return back(req, `Antwort an ${to} gesendet. Status bleibt "Antwort" — annehmen separat.`);
}
