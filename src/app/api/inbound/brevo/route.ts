// POST /api/inbound/brevo?secret=… — Brevo Inbound-Parsing-Webhook.
//
// Ersetzt den n8n Gmail-Reply-Tracker: statt eine Inbox zu pollen (OAuth, das
// silent ausläuft), liefert Brevo eingehende Mails als JSON hierher. Wir matchen
// die Mail auf ein Outreach-Target, hängen sie als Thread-Nachricht (direction
// 'in') an und stempeln das Target (status→replied, last_message, replied_at).
//
// Setup (einmalig, durch den User):
//   1. Subdomain reply.getklar.org mit MX → inbound1.sendinblue.com (10) +
//      inbound2.sendinblue.com (20).
//   2. In Brevo Inbound-Parsing diese Webhook-URL eintragen, inkl. ?secret=…
//      (KLAR_INBOUND_SECRET als env-var setzen, gleicher Wert).
//   3. Damit Replies hier landen, muss replyTo der Outreach-Mails auf
//      reply+<targetId>@reply.getklar.org zeigen (KLAR_INBOUND_DOMAIN env-var).
//      Die Admin-Reply-Route macht das bereits; Mail-1/Mail-2 folgen beim
//      n8n-Exit.
//
// Brevo POSTet keine Auth-Header, daher Secret im Query-String (fail-closed).

import { NextResponse, type NextRequest } from "next/server";
import {
  insertMessage,
  recordInboundReply,
  findTargetByEmail,
} from "@/lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface BrevoMailbox {
  Address?: string;
  Name?: string;
}
interface BrevoItem {
  From?: BrevoMailbox;
  To?: BrevoMailbox[];
  Cc?: BrevoMailbox[];
  Recipients?: string[];
  Subject?: string;
  RawTextBody?: string;
  RawHtmlBody?: string;
  ExtractedMarkdownMessage?: string;
  MessageId?: string;
  SentAtDate?: string;
  SpamScore?: number;
}

// Plain-text from an HTML body when no text part exists. Deliberately crude:
// strip tags, collapse whitespace, decode the handful of entities that matter.
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isoOrNull(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Pull a target id out of a reply+<uuid>@… subaddress in any recipient field.
function targetIdFromRecipients(item: BrevoItem): string | null {
  const addrs: string[] = [];
  for (const m of item.To ?? []) if (m.Address) addrs.push(m.Address);
  for (const m of item.Cc ?? []) if (m.Address) addrs.push(m.Address);
  for (const r of item.Recipients ?? []) if (r) addrs.push(r);
  for (const a of addrs) {
    const plus = a.split("@")[0] ?? "";
    if (plus.includes("+")) {
      const m = plus.match(UUID_RE);
      if (m) return m[0].toLowerCase();
    }
  }
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const SECRET = process.env.KLAR_INBOUND_SECRET ?? "";
  const given = req.nextUrl.searchParams.get("secret") ?? "";
  if (!SECRET || given !== SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: { items?: BrevoItem[] };
  try {
    payload = (await req.json()) as { items?: BrevoItem[] };
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  let matched = 0;
  let skipped = 0;

  for (const item of items) {
    const from = (item.From?.Address ?? "").trim().toLowerCase();
    const subject = (item.Subject ?? "").trim() || null;
    const body =
      (item.ExtractedMarkdownMessage && item.ExtractedMarkdownMessage.trim()) ||
      (item.RawTextBody && item.RawTextBody.trim()) ||
      (item.RawHtmlBody ? htmlToText(item.RawHtmlBody) : "") ||
      "";
    const sentAt = isoOrNull(item.SentAtDate);

    // Match: explicit reply+<id> subaddress first (survives a different
    // sender address), else the known contact_email.
    let targetId = targetIdFromRecipients(item);
    if (!targetId && from) {
      const t = await findTargetByEmail(from);
      if (t) targetId = t.id;
    }
    if (!targetId) {
      skipped++;
      continue;
    }

    await insertMessage({
      target_id: targetId,
      direction: "in",
      subject,
      body,
      from_email: from || null,
      provider: "brevo-inbound",
      external_id: (item.MessageId ?? "").trim() || null,
      spam_score: typeof item.SpamScore === "number" ? item.SpamScore : null,
      sent_at: sentAt,
    });
    await recordInboundReply(targetId, { body, subject, at: sentAt });
    matched++;
  }

  // Always 200 on a well-formed payload so Brevo does not retry-storm; the
  // matched/skipped counts make debugging visible without a retry.
  return NextResponse.json({ ok: true, processed: items.length, matched, skipped });
}

// Lightweight connectivity check (Brevo / manual curl) — never leaks data.
export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true, service: "klar-inbound-brevo" });
}
