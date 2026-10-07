// POST /api/inbound/brevo?secret=… — Brevo Inbound-Parsing-Webhook.
//
// Brevo liefert eingehende Mails als JSON hierher. Erkannt wird in dieser
// Reihenfolge: zuerst App-Feedback (feedback+<app>@), dann das Collab-Postfach
// (öffentliche App-Adresse). Alles andere wird gezählt und verworfen.
//
// Setup (einmalig, durch den User):
//   1. Subdomain reply.getklar.org mit MX → inbound1.sendinblue.com (10) +
//      inbound2.sendinblue.com (20).
//   2. In Brevo Inbound-Parsing diese Webhook-URL eintragen, inkl. ?secret=…
//      (KLAR_INBOUND_SECRET als env-var setzen, gleicher Wert).
//
// Brevo POSTet keine Auth-Header, daher Secret im Query-String (fail-closed).

import { NextResponse, type NextRequest } from "next/server";
import {
  collabRouteForRecipient,
  insertCollabMessage,
  detectCollabApp,
  type CollabRoute,
} from "@/lib/collabStore";
import { feedbackRoute, insertFeedback } from "@/lib/feedbackStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function recipientAddresses(item: BrevoItem): string[] {
  const addrs: string[] = [];
  for (const m of item.To ?? []) if (m.Address) addrs.push(m.Address);
  for (const m of item.Cc ?? []) if (m.Address) addrs.push(m.Address);
  for (const r of item.Recipients ?? []) if (r) addrs.push(r);
  return addrs;
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
  let collab = 0;
  let feedback = 0;
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

    // App-Feedback zuerst: die Support-Postfaecher der Apps leiten an
    // feedback+<app>@ weiter.
    const fb = from ? feedbackRoute(recipientAddresses(item), `${subject ?? ""}\n${body}`) : null;
    if (fb) {
      await insertFeedback({
        app: fb.app,
        inbox: fb.inbox,
        contact_email: from,
        contact_name: (item.From?.Name ?? "").trim() || null,
        subject,
        body,
        external_id: (item.MessageId ?? "").trim() || null,
        spam_score: typeof item.SpamScore === "number" ? item.SpamScore : null,
        sent_at: sentAt,
      });
      feedback++;
      continue;
    }

    // Dann der Collab-Alias im Empfänger: wer die öffentliche App-Adresse
    // anschreibt, meint das Collab-Postfach.
    if (from) {
      let route: CollabRoute | null = null;
      for (const addr of recipientAddresses(item)) {
        route = collabRouteForRecipient(addr);
        if (route) break;
      }
      if (route) {
        // Allgemeine Adresse (collab@ → studio): nennt der Text genau EINE App,
        // wird der Thread ihr zugeordnet; alias bleibt collab (Reply-Absender).
        const detectedApp =
          route.app === "studio" ? detectCollabApp(`${subject ?? ""}\n${body}`) : null;
        await insertCollabMessage({
          app: detectedApp ?? route.app,
          alias: route.alias,
          contact_email: from,
          contact_name: (item.From?.Name ?? "").trim() || null,
          direction: "in",
          subject,
          body,
          provider: "brevo-inbound",
          external_id: (item.MessageId ?? "").trim() || null,
          spam_score: typeof item.SpamScore === "number" ? item.SpamScore : null,
          sent_at: sentAt,
        });
        collab++;
        continue;
      }
    }
    skipped++;
  }

  // Always 200 on a well-formed payload so Brevo does not retry-storm; the
  // collab/feedback/skipped counts make debugging visible without a retry.
  return NextResponse.json({ ok: true, processed: items.length, collab, feedback, skipped });
}

// Lightweight connectivity check (Brevo / manual curl) — never leaks data.
export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true, service: "klar-inbound-brevo" });
}
