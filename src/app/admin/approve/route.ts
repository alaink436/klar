// Admin-only onboarding endpoint for affiliate applications submitted via
// the public `<AffiliateForm>`. Authed with the KLAR_ADMIN_KEY cookie that
// /admin uses.
//
// New flow (post-`influencer_onboarding_v1`):
//   1. Validate inputs (handle / app / email)
//   2. Call `create_influencer_setup` in the chosen app's Supabase. RPC
//      seeds an influencers row in `pending` status with a 7-day setup_token.
//   3. PATCH the originating `klar_inquiries` row with approved_app +
//      setup_token + status='invited' so /admin can re-find the link.
//   4. Return the onboarding link `<app-host>/affiliate/<token>`. Admin
//      copies + sends manually (auto-mail comes later).
//
// Returns JSON when Accept includes application/json (used by an inline
// progressive form). Otherwise redirects back to /admin?view=inbox so the
// row shows the new "invited" status.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { getApp, createInfluencerSetup, setupLandingUrl } from "@/lib/adminApps";

// Brevo SMTP for the auto-onboarding-mail beim Approve. Skip silently wenn
// kein API-Key gesetzt — Admin kann den Link weiterhin manuell senden.
const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
const APP_LABEL: Record<string, string> = {
  "yarn-stash": "Yarn-Stash",
  trubel: "Trubel",
  myloo: "MyLoo",
  wavelength: "Wavelength",
  kelva: "Kelva",
  moto: "ThrottleUp",
};

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
  const sigName = "Alain";
  const sigOrg = "Klar Studio";
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
  <p style="font-size:13px;color:#6B6B6B;margin:0">— ${sigName}, ${sigOrg}<br/><a href="https://getklar.org" style="color:#6B6B6B">getklar.org</a></p>
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
      console.warn(`[/admin/approve] brevo mail ${res.status}: ${text.slice(0, 200)}`);
      return { sent: false, error: `brevo ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[/admin/approve] brevo mail threw", msg);
    return { sent: false, error: msg };
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_RE = /^(de|en|fr|es|it|nl|pt|pl)$/;

function bad(message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status });
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

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return bad("admin not configured", 503);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    // UX: Form-Submit aus dem /admin Browser → redirect zu Login statt JSON-401.
    // JSON-API-Caller bekommen weiterhin 401 JSON.
    const accept = req.headers.get("accept") ?? "";
    if (!accept.includes("application/json")) {
      const next = encodeURIComponent("/admin?view=inbox");
      return NextResponse.redirect(new URL(`/admin/login?next=${next}`, req.url), 303);
    }
    return bad("unauthorized", 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("bad form");
  }

  const inquiryId = String(form.get("inquiry_id") ?? "").trim();
  const appSlug = String(form.get("app") ?? "").trim();
  const rawHandle = String(form.get("handle") ?? "").trim();
  const handle = rawHandle.replace(/^@/, "").toLowerCase();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const displayName = String(form.get("display_name") ?? "").trim();
  const language = String(form.get("language") ?? "de").trim().toLowerCase();
  const sharePct = Math.round(Number(form.get("share_pct") ?? 50));
  const shareMonths = Math.round(Number(form.get("share_months") ?? 24));

  if (!inquiryId) return bad("missing inquiry_id");
  if (!HANDLE_RE.test(handle)) return bad("handle invalid");
  if (!EMAIL_RE.test(email)) return bad("email invalid");
  if (!LANG_RE.test(language)) return bad("language invalid");
  if (!isFinite(sharePct) || sharePct <= 0 || sharePct > 100) {
    return bad("share_pct out of range");
  }
  if (!isFinite(shareMonths) || shareMonths <= 0 || shareMonths > 60) {
    return bad("share_months out of range");
  }

  const app = getApp(appSlug);
  if (!app) return bad(`unknown app: ${appSlug}`);

  // 1) Generate setup token in the app's Supabase. Throws if RPC missing or
  // permission denied — abort cleanly before touching the inbox row.
  let setup;
  try {
    setup = await createInfluencerSetup(app, {
      email,
      handle,
      displayName: displayName || handle,
      language,
      appSlug,
      sharePct,
      shareMonths,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return bad(`create_influencer_setup failed: ${msg}`, 502);
  }

  const landingUrl = setupLandingUrl(appSlug, setup.setup_token);

  // 2) Mark the inquiry as invited.
  try {
    await patchInquiry(inquiryId, {
      status: "invited",
      approved_app: appSlug,
      approved_code: setup.setup_token,
      approved_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        partial: true,
        error: `setup created but inquiry PATCH failed: ${msg}`,
        app: appSlug,
        token: setup.setup_token,
        landing_url: landingUrl,
      },
      { status: 502 },
    );
  }

  // 3) Auto-send onboarding-mail via Brevo. Best-effort — wenn's failed,
  // Approve gilt trotzdem als erfolgreich, Admin sieht das Resultat im
  // flash und kann den Link manuell per Copy-Button senden.
  const mailResult = await sendOnboardingMail({
    to: email,
    appSlug,
    handle,
    landingUrl,
    language,
  });

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json({
      ok: true,
      app: appSlug,
      token: setup.setup_token,
      handle: setup.handle,
      expires_at: setup.setup_token_expires_at,
      landing_url: landingUrl,
      mail_sent: mailResult.sent,
      mail_error: mailResult.error ?? null,
    });
  }
  const flash = mailResult.sent
    ? `@${handle} approved · mail sent`
    : `@${handle} approved · mail NOT sent (${mailResult.error ?? "no brevo"})`;
  return NextResponse.redirect(
    new URL(`/admin?view=inbox&msg=${encodeURIComponent(flash)}`, req.url),
    303,
  );
}
