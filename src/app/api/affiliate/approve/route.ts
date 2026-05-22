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

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json({
      ok: true,
      app: appSlug,
      token: setup.setup_token,
      handle: setup.handle,
      expires_at: setup.setup_token_expires_at,
      landing_url: landingUrl,
    });
  }
  return NextResponse.redirect(new URL("/admin?view=inbox", req.url), 303);
}
