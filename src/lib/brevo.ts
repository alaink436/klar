// SERVER ONLY. Dünner Brevo-Transactional-Wrapper für freie Outreach-Mails
// (Antworten auf Replies). Die polierten Onboarding-Mails laufen weiter über
// lib/affiliateApprove (sendOnboardingMail); das hier ist für vom Admin frei
// getippte Antworten gedacht.

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";

export function isBrevoConfigured(): boolean {
  return Boolean(BREVO_API_KEY);
}

export interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  tags?: string[];
}

export async function sendBrevoEmail(
  args: SendMailArgs,
): Promise<{ sent: boolean; error?: string }> {
  if (!BREVO_API_KEY) return { sent: false, error: "no BREVO_API_KEY" };
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
        replyTo: { email: args.replyTo ?? "alain@getklar.org", name: "Alain · Klar Studio" },
        tags: args.tags ?? [],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn(`[brevo] send ${res.status}: ${t.slice(0, 200)}`);
      return { sent: false, error: `brevo ${res.status}: ${t.slice(0, 160)}` };
    }
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[brevo] send threw", msg);
    return { sent: false, error: msg };
  }
}

// Verpackt vom Admin getippten Plain-Text in die Klar-Mail-Hülle. Newlines
// werden zu <br/>, HTML wird escaped (kein Markup-Injection aus dem Textfeld).
export function klarEmailShell(bodyText: string): string {
  const safe = bodyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif;color:#1A1A1A;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-family:'Geist','Inter',sans-serif;font-weight:800;font-size:28px;letter-spacing:-0.02em;margin-bottom:24px">Klar<span style="color:#A8A8A0">.</span></div>
  <div style="font-size:15px;color:#1A1A1A">${safe}</div>
  <hr style="border:none;border-top:1px solid #E4E4DD;margin:24px 0"/>
  <p style="font-size:13px;color:#6B6B6B;margin:0">Alain, Klar Studio<br/><a href="https://getklar.org" style="color:#6B6B6B">getklar.org</a></p>
</div></body></html>`;
}
