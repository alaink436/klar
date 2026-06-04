// SERVER ONLY. In-app outreach mailer: sends Mail-1 (first contact) and Mail-2
// (follow-up) directly via Brevo, replacing the SEND step of the n8n
// Wave-Consumer / SM2. Influencer discovery (Apify scrape) stays in n8n for now.
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
  listTargetsForMail2,
  markMailStage,
  checkSuppressions,
  getAppTemplate,
  type OutreachTarget,
} from "./outreachStore";
import { sendBrevoEmail } from "./brevo";

export type MailStage = "mail1" | "mail2";
export type MailerScope = "mail1" | "mail2" | "both";

export interface MailerItem {
  id: string;
  handle: string;
  email: string | null;
  app: string | null;
  stage: MailStage;
  subject: string;
  status: "sent" | "dry" | "skipped" | "error";
  reason?: string;
}

export interface MailerReport {
  live: boolean; // real sends actually happened this run
  dryRun: boolean; // caller asked for a dry run
  senderEnabled: boolean; // env KLAR_OUTREACH_SENDER === "on"
  scope: MailerScope;
  delayDays: number;
  cap: number;
  counts: { sent: number; dry: number; skipped: number; error: number };
  items: MailerItem[];
}

function pickLang(raw: string | null): string {
  const v = (raw || "").toLowerCase().slice(0, 2);
  return v === "en" || v === "es" || v === "it" || v === "fr" ? v : "de";
}
const subst = (s: string, name: string, handle: string): string =>
  (s || "").replace(/\{\{name\}\}/g, name).replace(/\{\{handle\}\}/g, handle);

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

async function processTarget(
  t: OutreachTarget,
  stage: MailStage,
  live: boolean,
): Promise<MailerItem> {
  const name = t.display_name || t.handle;
  const app = (t.for_apps && t.for_apps[0]) || null;
  const base: MailerItem = {
    id: t.id,
    handle: t.handle,
    email: t.contact_email,
    app,
    stage,
    subject: "",
    status: "skipped",
  };
  if (!t.contact_email) return { ...base, reason: "keine Email" };
  if (!app) return { ...base, reason: "keine App (for_apps leer)" };

  const lang = pickLang(t.language);
  const tpl = await getAppTemplate(app, lang);
  if (!tpl) return { ...base, reason: `kein Template ${app}/${lang}` };
  const rawSubject = stage === "mail1" ? tpl.mail1_subject : tpl.mail2_subject;
  const rawBody = stage === "mail1" ? tpl.mail1_body : tpl.mail2_body;
  if (!rawSubject || !rawBody) return { ...base, reason: `Template ${stage} leer (${app}/${lang})` };

  const subject = subst(rawSubject, name, t.handle);
  const body = subst(rawBody, name, t.handle);

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
    tags: [stage === "mail1" ? "outreach-mail1" : "outreach-mail2"],
  });
  if (!res.sent) return { ...base, subject, status: "error", reason: res.error ?? "send failed" };
  await markMailStage(t.id, stage);
  return { ...base, subject, status: "sent" };
}

export async function runOutreachMailer(opts: {
  scope?: MailerScope;
  delayDays?: number;
  cap?: number;
  dryRun?: boolean;
}): Promise<MailerReport> {
  const scope = opts.scope ?? "both";
  const delayDays = Math.min(
    Math.max(opts.delayDays ?? Number(process.env.KLAR_MAIL2_DELAY_DAYS ?? 3), 1),
    60,
  );
  const cap = Math.min(
    Math.max(opts.cap ?? Number(process.env.KLAR_OUTREACH_DAILY_CAP ?? 40), 1),
    300,
  );
  const dryRun = opts.dryRun !== false; // default true (safe)
  const senderEnabled = process.env.KLAR_OUTREACH_SENDER === "on";
  const live = senderEnabled && !dryRun;

  const items: MailerItem[] = [];
  let remaining = cap;

  if (scope === "mail1" || scope === "both") {
    const t1 = await listTargetsForMail1(remaining);
    for (const t of t1) {
      if (remaining <= 0) break;
      items.push(await processTarget(t, "mail1", live));
      remaining--;
    }
  }
  if ((scope === "mail2" || scope === "both") && remaining > 0) {
    const cutoff = new Date(Date.now() - delayDays * 86_400_000).toISOString();
    const t2 = await listTargetsForMail2(cutoff, remaining);
    for (const t of t2) {
      if (remaining <= 0) break;
      items.push(await processTarget(t, "mail2", live));
      remaining--;
    }
  }

  const counts = { sent: 0, dry: 0, skipped: 0, error: 0 };
  for (const it of items) counts[it.status]++;
  return { live, dryRun, senderEnabled, scope, delayDays, cap, counts, items };
}
