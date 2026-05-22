// SERVER ONLY. Core "approve an affiliate inquiry" logic, extracted out of
// the /admin/approve route so /api/inquiry can call it directly when the
// admin_settings.auto_accept_affiliates flag is on.
//
// Three side effects per call:
//   1. Mint a setup_token in the chosen app's Supabase via the
//      `create_influencer_setup` RPC.
//   2. PATCH the originating `klar_inquiries` row → status='invited',
//      approved_app + approved_code + approved_at stamped.
//   3. Best-effort Brevo onboarding mail to the influencer with their
//      setup link. Mail failures don't fail the approval.

import { getApp, createInfluencerSetup, setupLandingUrl } from "@/lib/adminApps";

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

const APP_LABEL: Record<string, string> = {
  "yarn-stash": "Yarn-Stash",
  trubel: "Trubel",
  myloo: "MyLoo",
  wavelength: "Wavelength",
  kelva: "Kelva",
  moto: "ThrottleUp",
};

export interface ApproveArgs {
  inquiryId: string;
  appSlug: string;
  handle: string;
  email: string;
  displayName?: string;
  language?: string;
  sharePct?: number;
  shareMonths?: number;
}

export interface ApproveResult {
  ok: boolean;
  token?: string;
  landingUrl?: string;
  mailSent?: boolean;
  mailError?: string | null;
  error?: string;
  partial?: boolean;
}

async function patchInquiry(
  inquiryId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!KLAR_INBOX_KEY) throw new Error("KLAR_INBOX_SERVICE_KEY not set");
  const res = await fetch(
    `${KLAR_INBOX_URL}/rest/v1/klar_inquiries?id=eq.${encodeURIComponent(inquiryId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: KLAR_INBOX_KEY,
        Authorization: `Bearer ${KLAR_INBOX_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`inquiry PATCH ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function sendOnboardingMail(args: {
  to: string;
  appSlug: string;
  handle: string;
  landingUrl: string;
  language: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!BREVO_API_KEY) return { sent: false, error: "no BREVO_API_KEY" };
  const appName = APP_LABEL[args.appSlug] ?? args.appSlug;
  const isEN = args.language === "en";
  const subject = isEN
    ? `Your ${appName} affiliate setup is ready, @${args.handle}`
    : `Dein ${appName}-Affiliate-Setup ist bereit, @${args.handle}`;
  const greeting = isEN ? "Hi" : "Hallo";
  const intro = isEN
    ? `welcome to the ${appName} affiliate program. Click below to finish your setup (payout method, country, tax status). Link is valid for 7 days.`
    : `willkommen im ${appName}-Affiliate-Programm. Klick unten um dein Setup abzuschliessen (Auszahlung, Land, Steuerstatus). Der Link ist 7 Tage gültig.`;
  const cta = isEN ? "Complete setup" : "Setup abschliessen";
  const fallback = isEN
    ? `Or paste this URL into your browser: ${args.landingUrl}`
    : `Oder kopier diese URL in deinen Browser: ${args.landingUrl}`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Inter','Helvetica Neue',Arial,sans-serif;color:#1A1A1A;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-family:'Geist','Inter',sans-serif;font-weight:800;font-size:28px;letter-spacing:-0.02em;margin-bottom:24px">Klar<span style="color:#A8A8A0">.</span></div>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;letter-spacing:-0.01em">${subject}</h1>
  <p style="font-size:15px;margin:0 0 24px;color:#404040">${greeting} ${args.handle},</p>
  <p style="font-size:15px;margin:0 0 28px;color:#404040">${intro}</p>
  <p style="margin:0 0 28px"><a href="${args.landingUrl}" style="display:inline-block;padding:12px 22px;background:#1A1A1A;color:#FAFAF7;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${cta} →</a></p>
  <p style="font-size:12px;color:#6B6B6B;margin:0 0 8px">${fallback}</p>
  <p style="font-size:12px;color:#6B6B6B;margin:0 0 24px;word-break:break-all"><a href="${args.landingUrl}" style="color:#6B6B6B">${args.landingUrl}</a></p>
  <hr style="border:none;border-top:1px solid #E4E4DD;margin:24px 0"/>
  <p style="font-size:13px;color:#6B6B6B;margin:0">— Alain, Klar Studio<br/><a href="https://getklar.org" style="color:#6B6B6B">getklar.org</a></p>
</div></body></html>`;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Klar Studio", email: "alain@getklar.org" },
        to: [{ email: args.to }],
        subject,
        htmlContent: html,
        replyTo: { email: "alain@getklar.org", name: "Alain · Klar Studio" },
        tags: ["affiliate-onboarding", `app:${args.appSlug}`],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[affiliateApprove] brevo mail ${res.status}: ${text.slice(0, 200)}`);
      return { sent: false, error: `brevo ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[affiliateApprove] brevo mail threw", msg);
    return { sent: false, error: msg };
  }
}

// Approve an inquiry: mint setup token in the target app's Supabase, mark
// the inquiry as invited, send the onboarding mail. Returns ok=false on
// validation or RPC failure; ok=true,partial=true if the RPC succeeded but
// the inquiry PATCH failed (caller may want to log + retry the patch).
export async function approveAffiliateCore(args: ApproveArgs): Promise<ApproveResult> {
  const app = getApp(args.appSlug);
  if (!app) return { ok: false, error: `unknown app: ${args.appSlug}` };

  const language = args.language ?? "de";
  const sharePct = Math.round(args.sharePct ?? 50);
  const shareMonths = Math.round(args.shareMonths ?? 24);

  let setup;
  try {
    setup = await createInfluencerSetup(app, {
      email: args.email,
      handle: args.handle,
      displayName: args.displayName || args.handle,
      language,
      appSlug: args.appSlug,
      sharePct,
      shareMonths,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `create_influencer_setup failed: ${msg}` };
  }

  const landingUrl = setupLandingUrl(args.appSlug, setup.setup_token);

  try {
    await patchInquiry(args.inquiryId, {
      status: "invited",
      approved_app: args.appSlug,
      approved_code: setup.setup_token,
      approved_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: true,
      partial: true,
      token: setup.setup_token,
      landingUrl,
      error: `setup created but inquiry PATCH failed: ${msg}`,
    };
  }

  const mailResult = await sendOnboardingMail({
    to: args.email,
    appSlug: args.appSlug,
    handle: args.handle,
    landingUrl,
    language,
  });

  return {
    ok: true,
    token: setup.setup_token,
    landingUrl,
    mailSent: mailResult.sent,
    mailError: mailResult.error ?? null,
  };
}
