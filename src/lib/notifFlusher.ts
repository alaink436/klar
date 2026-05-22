// SERVER ONLY. Reads admin_settings + admin_notif_log, decides whether the
// pending count crosses the configured batch_size, builds + sends one
// Brevo digest mail, and stamps emailed_at on the rows it sent.
//
// Called fire-and-forget from /api/inquiry (after inquiry_new is logged)
// and /api/affiliate/complete (after setup_completed is logged). Cheap-ish
// — when there's nothing to do it's one HTTP GET to PostgREST and returns.
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

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";

const APP_LABEL: Record<string, string> = {
  "yarn-stash": "Yarn-Stash",
  trubel: "Trubel",
  myloo: "MyLoo",
  wavelength: "Wavelength",
  kelva: "Kelva",
  moto: "ThrottleUp",
};

function buildDigestHtml(events: PendingNotif[]): { subject: string; html: string } {
  const inquiries = events.filter((e) => e.event_type === "inquiry_new");
  const completions = events.filter((e) => e.event_type === "setup_completed");
  const subject =
    `Klar Inbox Digest · ${events.length} Event${events.length === 1 ? "" : "s"}` +
    (inquiries.length ? ` · ${inquiries.length} neue Inquiries` : "") +
    (completions.length ? ` · ${completions.length} abgeschlossen` : "");

  const row = (e: PendingNotif) => {
    const when = new Date(e.created_at).toLocaleString("de-CH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const app = e.app_slug ? APP_LABEL[e.app_slug] ?? e.app_slug : "—";
    const who = e.handle ? `@${e.handle}` : "(kein Handle)";
    const kind =
      e.event_type === "inquiry_new" ? "neue Inquiry" : "Setup abgeschlossen";
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
  <p style="font-size:14px;margin:0 0 24px;color:#6B6B6B">${events.length} Event${events.length === 1 ? "" : "s"} seit der letzten Digest. ${inquiries.length} neue Inquiries, ${completions.length} abgeschlossene Setups.</p>
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
  <p style="margin:0 0 24px"><a href="https://getklar.org/admin?view=inbox" style="display:inline-block;padding:10px 18px;background:#1A1A1A;color:#FAFAF7;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px">Inbox öffnen →</a></p>
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
  if (!BREVO_API_KEY) {
    console.warn("[notifFlusher] BREVO_API_KEY missing, digest skipped");
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Klar Studio", email: "alain@getklar.org" },
        to: [{ email: args.to }],
        subject: args.subject,
        htmlContent: args.html,
        replyTo: { email: "alain@getklar.org", name: "Alain · Klar Studio" },
        tags: ["admin-inbox-digest"],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[notifFlusher] brevo ${res.status}: ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[notifFlusher] brevo threw", e);
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
    const eligible = pending.filter((e) => {
      if (e.event_type === "inquiry_new") return settings.notification_trigger_inquiry;
      if (e.event_type === "setup_completed") return settings.notification_trigger_complete;
      return false;
    });
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
