// SERVER ONLY. The mails a creator gets from us: once his TikTok is confirmed (Alain 2026-10-22: "per Email
// benachrichtigt, wenn man angenommen worden ist"), and the warning and the closing when he doesn't post
// (lib/creatorInactive). Dark and centred like the login mail from the hub, from the same sender as the strike mails
// in lib/postCheck; a reply lands in the Klar inbox.

import { Resend } from "resend";
import { getForProxy } from "@/lib/vault";

const RESEND_SECRET_ID = "3400552d-aed3-43fa-b1de-ff36632c789c"; // as lib/notifFlusher
const DASHBOARD = "https://getklar.org/dashboard";

export interface CreatorMail {
  subject: string;
  html: string;
  text: string;
}

/** The card every creator mail shares: heading with one word in italic serif, a paragraph, an optional grey box, the
    dashboard button, an optional line under it. */
function frame(o: { heading: string; body: string; box?: string; button: string; note?: string }): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0c;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#141418;border:1px solid #2a2a30;border-radius:14px;padding:36px 32px;">
          <tr>
            <td align="center" style="text-align:center;">
              <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#888;margin-bottom:10px;font-family:ui-monospace,Menlo,monospace;">
                Klar Studios &middot; Creators
              </div>
              <h1 style="font-size:32px;line-height:1.1;letter-spacing:-0.6px;margin:0 0 14px;color:#f5f5f7;font-weight:600;">
                ${o.heading}
              </h1>
              <p style="font-size:15px;line-height:1.55;color:#b5b5bd;margin:0 0 18px;">
                ${o.body}
              </p>${o.box ? `
              <p style="font-size:14px;line-height:1.5;color:#f5f5f7;margin:0 0 26px;padding:12px 16px;background:#1c1c22;border:1px solid #2a2a30;border-radius:10px;">
                ${o.box}
              </p>` : ""}
              <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:10px;background:#f5f5f7;">
                    <a href="${DASHBOARD}" style="display:inline-block;padding:14px 28px;color:#0a0a0c;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">
                      ${o.button}
                    </a>
                  </td>
                </tr>
              </table>${o.note ? `
              <p style="font-size:13px;line-height:1.55;color:#9d9da6;margin:24px 0 0;">
                ${o.note}
              </p>` : ""}
              <hr style="border:none;border-top:1px solid #2a2a30;margin:32px 0 16px;">
              <p style="font-size:12px;color:#666;margin:0;line-height:1.6;">
                Questions? <a href="mailto:alain@getklar.org" style="color:#9d9da6;">alain@getklar.org</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="font-size:11px;color:#555;margin:18px 0 0;">
          Klar &middot; <a href="https://getklar.org" style="color:#777;text-decoration:none;">getklar.org</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Handles are [a-z0-9_.] (HANDLE_RE in lib/creatorAccounts) and codes "klar-" plus letters and digits, so both go
    into the HTML unescaped. Taking the code out of the bio again is its own line (Alain 2026-10-22). */
export function confirmedMail(handle: string, code: string): CreatorMail {
  return {
    subject: "You're confirmed",
    text: `Hi @${handle}, we saw the code in your TikTok bio, your account is confirmed. From now on the posts you make from your dashboard count. You can take ${code} out of your bio again. Before you post, have a look at "How to post" at the bottom of your dashboard: ${DASHBOARD}`,
    html: frame({
      heading: `You're <i style="font-family:Georgia,serif;color:#fff;">confirmed</i>.`,
      body: `We saw the code in the bio of @${handle}. From now on the posts you make from your dashboard count.`,
      box: `You can take <span style="font-family:ui-monospace,Menlo,monospace;letter-spacing:0.5px;">${code}</span> out of your bio again.`,
      button: "Open your dashboard",
      note: "Before you post, read &ldquo;How to post&rdquo; at the bottom of your dashboard.",
    }),
  };
}

const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** A week without a slideshow from his dashboard. The mail is the reminder nobody got before (Alain 2026-10-24), so
    it leads to the slideshows first and names the deadline second. `posted`: he posted before and went quiet. */
export function inactiveWarnMail(handle: string, deadline: Date, posted: boolean): CreatorMail {
  const since = posted ? "It's been a week since your last slideshow" : "You signed up a week ago, but no slideshow from your dashboard is up yet";
  return {
    subject: "Your slideshows are waiting",
    text: `Hi @${handle}, ${since.charAt(0).toLowerCase()}${since.slice(1)}. Your slideshows are ready in your dashboard: ${DASHBOARD}\n\nPost one by ${day(deadline)}. If nothing is up by then, we close your account.\n\nSomething in the way? Just reply to this email.`,
    html: frame({
      heading: `Your slideshows are <i style="font-family:Georgia,serif;color:#fff;">waiting</i>.`,
      body: `${since}, @${handle}. They're ready in your dashboard.`,
      box: `Post one by ${day(deadline)}. If nothing is up by then, we close your account.`,
      button: "Open your slideshows",
      note: "Something in the way? Just reply to this email.",
    }),
  };
}

/** Closed after the warning. Earnings from posts that counted are paid out like after three strikes. */
export function inactiveClosedMail(handle: string): CreatorMail {
  return {
    subject: "Your account is closed",
    text: `Hi @${handle}, no slideshow from your dashboard went up after our last email, so we closed your account and stopped reading your posts. What you earned with posts that counted is still paid out.\n\nWant back in? Reply to this email.`,
    html: frame({
      heading: `Your account is <i style="font-family:Georgia,serif;color:#fff;">closed</i>.`,
      body: `No slideshow from your dashboard went up after our last email, so we closed the account of @${handle} and stopped reading your posts.`,
      box: "What you earned with posts that counted is still paid out.",
      button: "Open your dashboard",
      note: "Want back in? Reply to this email.",
    }),
  };
}

export async function sendCreatorMail(to: string, mail: CreatorMail): Promise<void> {
  const resend = await getForProxy(RESEND_SECRET_ID);
  if (!resend) return;
  try {
    const { error } = await new Resend(resend.key).emails.send({ from: "Klar Studios <postfach@getklar.org>", to, ...mail });
    if (error) console.warn("[creatorMail] resend", error);
  } catch (e) {
    console.warn("[creatorMail] resend threw", e);
  }
}

export async function sendConfirmedMail(to: string, handle: string, code: string): Promise<void> {
  await sendCreatorMail(to, confirmedMail(handle, code));
}
