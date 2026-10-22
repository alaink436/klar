// SERVER ONLY. Reads admin_settings + admin_notif_log, decides whether the
// pending count crosses the configured batch_size, builds + sends one
// digest mail through Resend, and stamps emailed_at on the rows it sent.
//
// Called inside after() from /api/inquiry once inquiry_new is logged, and from
// /dashboard/signup once creator_signup is.
// Cheap-ish — when there's nothing to do it's one HTTP GET to PostgREST and
// returns.
//
// Concurrency: two simultaneous events could each see "count == batch_size"
// and both flush. We accept the rare double-send rather than introducing
// a lock — the digest mail is idempotent enough (it's a summary) and the
// markNotifsEmailed call uses an `in.(ids)` filter so each row is stamped
// at most once.

import {
  getAdminSettings,
  listPendingNotifs,
  markNotifsEmailed,
  type PendingNotif,
} from "@/lib/adminSettings";
import { Resend } from "resend";
import { getForProxy } from "@/lib/vault";

// Same vault entry ("Resend API-Key") the inbound route uses. Until 2026-10-14
// the digest went through Brevo, which went quiet with the outreach pipeline:
// not one digest was ever stamped as sent.
const RESEND_SECRET_ID = "3400552d-aed3-43fa-b1de-ff36632c789c";

const APP_LABEL: Record<string, string> = {
  "yarn-stash": "Yarn-Stash",
  trubel: "Trubel",
  myloo: "Pocketmate",
  wavelength: "Basalt",
  basalt: "Basalt", // the creator platform's slug (klar_creator_accounts.app_slug)
  kelva: "Kelva",
  moto: "ThrottleUp",
  "anime-vault": "Anime Vault",
  learnbound: "Learnbound",
};

/** "1 neue Anmeldung, 2 neue Inquiries": what the digest holds, for subject and intro. */
export function digestCounts(events: Pick<PendingNotif, "event_type">[]): string {
  const signups = events.filter((e) => e.event_type === "creator_signup").length;
  const inquiries = events.length - signups;
  const parts: string[] = [];
  if (signups) parts.push(`${signups} neue Anmeldung${signups === 1 ? "" : "en"}`);
  if (inquiries) parts.push(`${inquiries} neue Inquir${inquiries === 1 ? "y" : "ies"}`);
  return parts.join(", ");
}

export function buildDigestHtml(events: PendingNotif[]): { subject: string; html: string } {
  const subject = `Klar Inbox Digest · ${digestCounts(events)}`;

  const row = (e: PendingNotif) => {
    // Swiss time: Vercel runs in UTC, so without the zone the digest said 08:54 for 10:54.
    const when = new Date(e.created_at).toLocaleString("de-CH", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const app = e.app_slug ? APP_LABEL[e.app_slug] ?? e.app_slug : "—";
    // A sign-up arrives at the first login, before a TikTok is connected: then the mail address says who.
    const email = typeof e.payload?.email === "string" ? e.payload.email : null;
    const who = e.handle ? `@${e.handle}` : (email ?? "(kein Handle)");
    const kind = e.event_type === "creator_signup" ? "neue Creator-Anmeldung" : "neue Inquiry";
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E4E4DD;font-family:'JetBrains Mono',monospace;font-size:11px;color:#6B6B6B;white-space:nowrap">${when}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E4E4DD;font-size:13px;color:#1A1A1A">${kind}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E4E4DD;font-size:13px;color:#404040">${app}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E4E4DD;font-size:13px;color:#404040">${who}</td>
    </tr>`;
  };

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif;color:#1A1A1A;line-height:1.55">
<div style="max-width:680px;margin:0 auto;padding:32px 24px">
  <div style="font-family:'Geist','Inter',sans-serif;font-weight:800;font-size:28px;letter-spacing:-0.02em;margin-bottom:24px">Klar<span style="color:#A8A8A0">.</span></div>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 8px;letter-spacing:-0.01em">Inbox Digest</h1>
  <p style="font-size:14px;margin:0 0 24px;color:#6B6B6B">${digestCounts(events)} seit der letzten Digest.</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
    <thead>
      <tr style="background:#F4F4F0">
        <th style="text-align:left;padding:8px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6B6B;font-weight:600;border-bottom:1px solid #CFCFC7">Wann</th>
        <th style="text-align:left;padding:8px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6B6B;font-weight:600;border-bottom:1px solid #CFCFC7">Event</th>
        <th style="text-align:left;padding:8px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6B6B;font-weight:600;border-bottom:1px solid #CFCFC7">App</th>
        <th style="text-align:left;padding:8px 10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6B6B;font-weight:600;border-bottom:1px solid #CFCFC7">Wer</th>
      </tr>
    </thead>
    <tbody>${events.map(row).join("")}</tbody>
  </table>
  <p style="margin:0 0 24px"><a href="https://getklar.org/admin/bewerbungen" style="display:inline-block;padding:10px 18px;background:#1A1A1A;color:#FAFAF7;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px">Bewerbungen öffnen →</a></p>
  <hr style="border:none;border-top:1px solid #E4E4DD;margin:24px 0"/>
  <p style="font-size:12px;color:#6B6B6B;margin:0">Digest-Frequenz änderbar unter <a href="https://getklar.org/admin/settings" style="color:#6B6B6B">getklar.org/admin/settings</a>.</p>
</div></body></html>`;

  return { subject, html };
}

async function sendDigest(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const resend = await getForProxy(RESEND_SECRET_ID);
  if (!resend) {
    console.warn('[notifFlusher] vault entry "Resend API-Key" unusable, digest skipped');
    return false;
  }
  try {
    const { error } = await new Resend(resend.key).emails.send({
      from: "Klar Postfach <postfach@getklar.org>",
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    if (error) {
      console.warn("[notifFlusher] resend", error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[notifFlusher] resend threw", e);
    return false;
  }
}

// Main entry. Reads settings, checks pending count, flushes if threshold met.
// Returns true if a digest was sent. Callers can ignore the return value;
// errors are swallowed + logged so the caller never breaks on flush issues.
export async function flushNotifsIfBatchReady(): Promise<boolean> {
  try {
    const settings = await getAdminSettings({ revalidate: 0 });
    const pending = await listPendingNotifs();
    // Filter out events whose trigger is currently disabled. The trigger
    // toggles persist after the event was logged, so we re-check at flush
    // time — admin can disable a trigger and the queued events for that
    // trigger sit until the trigger gets re-enabled (or until enough OTHER
    // events accumulate to flush them together).
    const eligible = pending.filter(
      (e) => (e.event_type === "inquiry_new" || e.event_type === "creator_signup") && settings.notification_trigger_inquiry,
    );
    if (eligible.length < settings.notification_batch_size) return false;

    const { subject, html } = buildDigestHtml(eligible);
    const sent = await sendDigest({
      to: settings.notification_recipient_email,
      subject,
      html,
    });
    if (!sent) return false;
    await markNotifsEmailed(eligible.map((e) => e.id));
    return true;
  } catch (e) {
    console.warn("[notifFlusher] flush threw", e);
    return false;
  }
}
