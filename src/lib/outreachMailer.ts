// SERVER ONLY. In-app outreach mailer: sends Mail-1 (cold first contact) only,
// directly via Brevo, replacing the Mail-1 SEND step of the n8n Wave-Consumer.
// Influencer discovery (Apify scrape) stays in n8n for now.
//
// Mail-2 (the interest/detail mail with Cal-/Redeem-/Onboarding-Links and
// "glad you're interested" copy) is NOT handled here — it is an interested-reply
// email and is sent on-demand from the reply/accept flow, never blasted to
// non-responders.
//
// SAFETY MODEL — a real send happens ONLY when BOTH are true:
//   1. env KLAR_OUTREACH_SENDER === "on"   (hard gate, set in Vercel)
//   2. the caller passes dryRun: false
// Otherwise every selected target is reported as "dry" and nothing leaves the
// building. The admin button defaults to dry-run; the cron passes dryRun:false
// but is still gated by the env flag. Suppression list is checked before every
// send, fail-closed.

import {
  listTargetsForMail1,
  markMail1Sent,
  insertMessage,
  checkSuppressions,
  getAppTemplate,
  type OutreachTarget,
} from "./outreachStore";
import { sendBrevoEmail } from "./brevo";

export interface MailerItem {
  id: string;
  handle: string;
  email: string | null;
  app: string | null;
  subject: string;
  status: "sent" | "dry" | "skipped" | "error";
  reason?: string;
}

export interface MailerReport {
  live: boolean; // real sends actually happened this run
  dryRun: boolean; // caller asked for a dry run
  senderEnabled: boolean; // env KLAR_OUTREACH_SENDER === "on"
  cap: number;
  counts: { sent: number; dry: number; skipped: number; error: number };
  items: MailerItem[];
}

function pickLang(raw: string | null): string {
  const v = (raw || "").toLowerCase().slice(0, 2);
  return v === "en" || v === "es" || v === "it" || v === "fr" ? v : "de";
}

// klar_app_mail_templates use UPPERCASE {{NAME}} / {{HANDLE}} tokens (matching
// the n8n render node). Case-insensitive so a lowercase variant also works.
function subst(s: string, name: string, handle: string): string {
  return (s || "")
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{handle\}\}/gi, handle);
}

// Plain "phone-typed" shell: NO Klar branding, box, divider or footer — matches
// the n8n Render-Mail-1 anti-template look (a real first-contact mail should not
// look like a newsletter). Just the body text, newlines to <br>.
export function outreachMailShell(bodyText: string): string {
  const safe = bodyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff"><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111111;max-width:560px;margin:0 auto;padding:16px">${safe}</div></body></html>`;
}

const INBOUND_DOMAIN = (process.env.KLAR_INBOUND_DOMAIN ?? "").trim();
function replyToFor(id: string): string | undefined {
  return INBOUND_DOMAIN ? `reply+${id}@${INBOUND_DOMAIN}` : undefined;
}

async function processMail1(t: OutreachTarget, live: boolean): Promise<MailerItem> {
  const name = t.display_name || t.handle;
  const app = (t.for_apps && t.for_apps[0]) || null;
  const base: MailerItem = {
    id: t.id,
    handle: t.handle,
    email: t.contact_email,
    app,
    subject: "",
    status: "skipped",
  };
  if (!t.contact_email) return { ...base, reason: "keine Email" };
  if (!app) return { ...base, reason: "keine App (for_apps leer)" };

  const lang = pickLang(t.language);
  const tpl = await getAppTemplate(app, lang);
  if (!tpl) return { ...base, reason: `kein Template ${app}/${lang}` };
  if (!tpl.mail1_subject || !tpl.mail1_body) return { ...base, reason: `Mail-1-Template leer (${app}/${lang})` };

  const subject = subst(tpl.mail1_subject, name, t.handle);
  const body = subst(tpl.mail1_body, name, t.handle);

  // Suppression check, fail-closed (a thrown/empty result does not bypass).
  const platform =
    t.platform === "tiktok" || t.platform === "instagram" ? t.platform : undefined;
  const sup = await checkSuppressions({
    handles: [t.handle],
    platform,
    emails: [t.contact_email],
  });
  if (sup.length > 0) return { ...base, subject, reason: "suppression" };

  if (!live) return { ...base, subject, status: "dry" };

  const res = await sendBrevoEmail({
    to: t.contact_email,
    subject: subject.slice(0, 300),
    html: outreachMailShell(body.slice(0, 8000)),
    replyTo: replyToFor(t.id),
    tags: ["outreach-mail1"],
  });
  if (!res.sent) return { ...base, subject, status: "error", reason: res.error ?? "send failed" };
  await markMail1Sent(t.id);
  // Record the sent Mail-1 in the thread so the inbox shows the full outgoing
  // mail (text + position), not just a "contacted" placeholder. Dedupe via
  // external_id so a re-run never doubles it. Best-effort (mail already sent).
  await insertMessage({
    target_id: t.id,
    direction: "out",
    subject,
    body,
    to_email: t.contact_email,
    provider: "brevo-mail1",
    external_id: `mail1-${t.id}`,
    sent_at: new Date().toISOString(),
  });
  return { ...base, subject, status: "sent" };
}

export async function runOutreachMailer(opts: {
  cap?: number;
  dryRun?: boolean;
}): Promise<MailerReport> {
  const cap = Math.min(
    Math.max(opts.cap ?? Number(process.env.KLAR_OUTREACH_DAILY_CAP ?? 40), 1),
    300,
  );
  const dryRun = opts.dryRun !== false; // default true (safe)
  const senderEnabled = process.env.KLAR_OUTREACH_SENDER === "on";
  const live = senderEnabled && !dryRun;

  // Cold first-contact only (Mail-1). Mail-2 detail mail is sent on-demand from
  // the reply/accept flow, not blasted to non-responders here.
  const items: MailerItem[] = [];
  const t1 = await listTargetsForMail1(cap);
  for (const t of t1) items.push(await processMail1(t, live));

  const counts = { sent: 0, dry: 0, skipped: 0, error: 0 };
  for (const it of items) counts[it.status]++;
  return { live, dryRun, senderEnabled, cap, counts, items };
}
