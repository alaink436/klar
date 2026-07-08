// POST /admin/collab/reply — antwortet auf eine Collab-Anfrage, die über eine
// öffentliche per-App Adresse (z.B. animevault@reply.getklar.org auf dem
// TikTok-Kanal) reinkam. Versand per Brevo; replyTo zeigt auf dieselbe
// Alias-Adresse, damit die Gegenantwort wieder im Inbound-Webhook (und damit
// im selben Inbox-Thread) landet. Bewusst getrennt von /admin/outreach/reply —
// hier gibt es kein Outreach-Target und keinen Status-Lifecycle.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import {
  COLLAB_ALIASES,
  collabAddressFor,
  insertCollabMessage,
} from "@/lib/collabStore";
import { sendBrevoEmail, klarEmailShell } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest): Promise<Response> {
  // Einziger Caller ist der Inbox-MailClient (fetch, ?json=1) — immer JSON.
  const done = (ok: boolean, msg: string, status = 400): Response =>
    NextResponse.json({ ok, msg }, { status: ok ? 200 : status });

  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return done(false, "Server misconfigured", 500);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return done(false, "unauthorized", 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return done(false, "Bad form");
  }

  const alias = String(form.get("alias") ?? "").trim().toLowerCase();
  const app = String(form.get("app") ?? "").trim().toLowerCase();
  const to = String(form.get("to") ?? "").trim().toLowerCase();
  const subject = String(form.get("subject") ?? "").trim();
  const bodyText = String(form.get("body") ?? "").trim();

  const aliasMeta = COLLAB_ALIASES[alias];
  if (!aliasMeta || aliasMeta.app !== app) return done(false, "Unbekanntes Collab-Postfach");
  if (!EMAIL_RE.test(to)) return done(false, "Empfänger-Email ungültig");
  if (!subject) return done(false, "Betreff fehlt");
  if (!bodyText) return done(false, "Nachricht fehlt");

  // replyTo auf die Alias-Adresse: die Gegenantwort kommt über den Brevo-
  // Inbound-Webhook zurück in denselben Thread. Ohne konfigurierte Domain
  // würde der Thread reissen — deshalb fail-closed.
  const replyTo = collabAddressFor(alias);
  if (!replyTo) return done(false, "KLAR_INBOUND_DOMAIN fehlt — Collab-Antworten brauchen die Inbound-Domain", 500);

  const mail = await sendBrevoEmail({
    to,
    subject: subject.slice(0, 300),
    html: klarEmailShell(bodyText.slice(0, 8000)),
    replyTo,
    tags: ["collab-reply", `collab-${app}`],
  });
  if (!mail.sent) return done(false, `Mail NICHT gesendet (${mail.error ?? "?"})`, 502);

  // Gesendete Antwort in den Thread schreiben (best-effort — die Mail ist raus).
  await insertCollabMessage({
    app,
    alias,
    contact_email: to,
    direction: "out",
    subject: subject.slice(0, 300),
    body: bodyText.slice(0, 8000),
    provider: "brevo",
  });

  return done(true, `Antwort an ${to} gesendet (Absender-Reply: ${replyTo}).`);
}
