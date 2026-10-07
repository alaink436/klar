// POST /api/inbound/resend: Resend-Empfang fuer die Wurzeldomain getklar.org.
//
// Bis 2026-10-07 hatte getklar.org keinen MX: support@ und alain@ standen in
// Datenschutz, AGB und Vertraegen, aber jede Mail daran ging verloren. Jetzt
// zeigt der MX auf Resend, Resend meldet `email.received` hierher, und diese
// Route schickt die Mail unveraendert an KLAR_INBOUND_FORWARD_TO weiter.
//
// Nicht resend.emails.receiving.forward(): das setzt kein Reply-To. In Gmail
// stuende die Weiterleitungsadresse als Absender, und "Antworten" ginge an uns
// selbst zurueck. Hier gleich gebaut wie dort, plus Reply-To und der Name des
// echten Absenders.
//
// ⚠️ Der Webhook haengt am Resend-KONTO, nicht an der Domain. Im selben Konto
// empfaengt auch mycakeday.ch; was nicht an getklar.org ging, wird verworfen,
// bevor die Mail abgeholt wird.
// ⚠️ Der Pfad ist bei Resend registriert. Umbenennen heisst Webhook neu anlegen.
//
// Env: RESEND_WEBHOOK_SECRET (Signing-Secret des Webhooks),
//      KLAR_INBOUND_FORWARD_TO (Ziel, darf nicht auf getklar.org liegen).
// Der API-Key kommt aus dem Vault (Eintrag "Resend API-Key").

import { NextResponse } from "next/server";
import PostalMime from "postal-mime";
import { Resend } from "resend";
import { getForProxy } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAIN = "getklar.org";
const RESEND_SECRET_ID = "3400552d-aed3-43fa-b1de-ff36632c789c"; // vault: "Resend API-Key"
const SENDER = `weiterleitung@${DOMAIN}`;

function parseMailbox(raw: string): { address: string; name: string } {
  const m = raw.match(/^(.*)<([^>]+)>\s*$/);
  if (m) return { address: m[2].trim().toLowerCase(), name: m[1].trim().replace(/^"|"$/g, "").trim() };
  return { address: raw.trim().toLowerCase(), name: "" };
}

// Split at the LAST @: "x@getklar.org@fremd.ch" is delivered to fremd.ch.
function isOurs(raw: string): boolean {
  const address = parseMailbox(raw).address;
  const at = address.lastIndexOf("@");
  if (at < 1) return false;
  const domain = address.slice(at + 1);
  return domain === DOMAIN || domain.endsWith(`.${DOMAIN}`);
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  const target = (process.env.KLAR_INBOUND_FORWARD_TO ?? "").trim();
  // 503, not 200: Resend keeps the mail and retries instead of marking it delivered.
  // A target on our own domain would forward in a circle.
  if (!secret || !target || isOurs(target)) {
    console.error("inbound/resend: RESEND_WEBHOOK_SECRET or KLAR_INBOUND_FORWARD_TO missing or invalid");
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }
  const routing = await getForProxy(RESEND_SECRET_ID);
  if (!routing) {
    console.error('inbound/resend: vault entry "Resend API-Key" unusable');
    return NextResponse.json({ ok: false, error: "no resend key" }, { status: 503 });
  }
  const resend = new Resend(routing.key);

  // The raw text, not req.json(): the signature covers these exact bytes.
  const payload = await req.text();
  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  // Everything below answers 200 when it is simply not for us, so Resend does not retry.
  if (event.type !== "email.received") return NextResponse.json({ ok: true, skipped: event.type });
  const d = event.data;
  const recipients = [...(d.received_for ?? []), ...(d.to ?? []), ...(d.cc ?? []), ...(d.bcc ?? [])];
  if (!recipients.some(isOurs)) return NextResponse.json({ ok: true, skipped: "foreign domain" });

  const { data: mail, error } = await resend.emails.receiving.get(d.email_id);
  if (error || !mail?.raw?.download_url) {
    console.error("inbound/resend: mail not retrievable", error);
    return NextResponse.json({ ok: false, error: "mail not retrievable" }, { status: 500 });
  }
  const raw = await fetch(mail.raw.download_url, { cache: "no-store" });
  if (!raw.ok) {
    console.error("inbound/resend: raw download failed", raw.status);
    return NextResponse.json({ ok: false, error: "raw download failed" }, { status: 500 });
  }
  const parsed = await PostalMime.parse(await raw.arrayBuffer(), { attachmentEncoding: "base64" });

  // Resend's `from` is the bare address; the display name only survives in the raw headers.
  const sender = parseMailbox(mail.from);
  const name = parsed.from?.name || sender.name;
  const label = (name || sender.address.replace("@", " at ")).replace(/["<>\r\n]/g, "").slice(0, 80);
  const content = parsed.html
    ? { html: parsed.html, text: parsed.text || undefined }
    : { text: parsed.text || "(ohne Inhalt)" };
  const { error: sendError } = await resend.emails.send(
    {
      from: `"${label} via ${DOMAIN}" <${SENDER}>`,
      to: target,
      replyTo: sender.address,
      subject: mail.subject || "(kein Betreff)",
      ...content,
      attachments: parsed.attachments.map((a) => ({
        filename: a.filename ?? undefined,
        content: String(a.content),
        contentType: a.mimeType,
        contentId: a.contentId?.replace(/^<|>$/g, "") || undefined,
      })),
    },
    // Webhook retries must not forward the same mail twice.
    { idempotencyKey: `klar-inbound-${d.email_id}` },
  );
  if (sendError) {
    console.error("inbound/resend: forward failed", sendError);
    return NextResponse.json({ ok: false, error: "forward failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, forwarded: true });
}

// Connectivity check, never leaks data.
export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true, service: "klar-inbound-resend" });
}
