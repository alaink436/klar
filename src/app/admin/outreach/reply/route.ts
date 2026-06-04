// POST /admin/outreach/reply — schickt eine frei verfasste Antwort (aus einer
// der Vorlagen oder selbst getippt) per Brevo an die contact_email des Targets.
//
// WICHTIG: Eine Antwort ändert den Status NICHT. Das Target bleibt `replied`.
// Nur weil man zurückschreibt, ist der Influencer noch kein Affiliate — das
// passiert erst über die explizite "Als Affiliate annehmen"-Aktion
// (/admin/outreach/accept). Hier wird lediglich der mails_sent-Zähler erhöht.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { markMailSent, insertMessage } from "@/lib/outreachStore";
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
  // The mail-client posts with ?json=1 and wants a JSON result (no redirect),
  // so it can append the sent message to the thread without a full reload. The
  // legacy outreach-view forms post without it and still get a 303 redirect.
  const wantsJson = req.nextUrl.searchParams.get("json") === "1";
  const done = (ok: boolean, msg: string, status = 400): Response =>
    wantsJson
      ? NextResponse.json({ ok, msg }, { status: ok ? 200 : status })
      : back(req, msg);

  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return done(false, "Server misconfigured", 500);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return wantsJson
      ? NextResponse.json({ ok: false, msg: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return done(false, "Bad form");
  }

  const id = String(form.get("id") ?? "").trim();
  const to = String(form.get("to") ?? "").trim().toLowerCase();
  const subject = String(form.get("subject") ?? "").trim();
  const bodyText = String(form.get("body") ?? "").trim();

  if (!UUID_RE.test(id)) return done(false, "id ungültig");
  if (!EMAIL_RE.test(to)) return done(false, "Empfänger-Email ungültig");
  if (!subject) return done(false, "Betreff fehlt");
  if (!bodyText) return done(false, "Nachricht fehlt");

  // replyTo auf die Inbound-Subdomain, damit die Antwort des Influencers zum
  // /api/inbound/brevo-Webhook zurückkommt (nicht in eine gepollte Gmail-Inbox).
  // Ohne KLAR_INBOUND_DOMAIN bleibt es beim Brevo-Default (alain@getklar.org).
  const inboundDomain = (process.env.KLAR_INBOUND_DOMAIN ?? "").trim();
  const replyTo = inboundDomain ? `reply+${id}@${inboundDomain}` : undefined;

  const mail = await sendBrevoEmail({
    to,
    subject: subject.slice(0, 300),
    html: klarEmailShell(bodyText.slice(0, 8000)),
    replyTo,
    tags: ["outreach-reply"],
  });
  if (!mail.sent) return done(false, `Mail NICHT gesendet (${mail.error ?? "?"})`, 502);

  // Gesendete Antwort in den Thread schreiben (best-effort) + mails_sent
  // hochzählen. Status bleibt 'replied' — annehmen ist ein separater Klick.
  await insertMessage({
    target_id: id,
    direction: "out",
    subject: subject.slice(0, 300),
    body: bodyText.slice(0, 8000),
    to_email: to,
    provider: "brevo",
  });
  try {
    await markMailSent(id);
  } catch {
    /* Zähler ist observational, nicht kritisch */
  }

  return done(true, `Antwort an ${to} gesendet. Status bleibt "Antwort" — annehmen separat.`);
}
