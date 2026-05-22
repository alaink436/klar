// Admin-only onboarding endpoint for affiliate applications submitted via
// the public `<AffiliateForm>`. Authed with the KLAR_ADMIN_KEY cookie that
// /admin uses.
//
// Core flow lives in src/lib/affiliateApprove.ts so /api/inquiry can also
// call it when admin_settings.auto_accept_affiliates is on. This file is
// now a thin auth + validation + form-parse wrapper around it.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { approveAffiliateCore } from "@/lib/affiliateApprove";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_RE = /^(de|en|fr|es|it|nl|pt|pl)$/;

function bad(message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return bad("admin not configured", 503);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
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

  const result = await approveAffiliateCore({
    inquiryId,
    appSlug,
    handle,
    email,
    displayName: displayName || handle,
    language,
    sharePct,
    shareMonths,
  });

  if (!result.ok) {
    return bad(result.error ?? "approve failed", 502);
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json({
      ok: true,
      partial: result.partial ?? false,
      app: appSlug,
      token: result.token,
      handle,
      landing_url: result.landingUrl,
      mail_sent: result.mailSent ?? false,
      mail_error: result.mailError ?? null,
    });
  }
  const flash = result.partial
    ? `@${handle} approved but inquiry PATCH failed — token: ${result.token}`
    : result.mailSent
      ? `@${handle} approved · mail sent`
      : `@${handle} approved · mail NOT sent (${result.mailError ?? "no brevo"})`;
  return NextResponse.redirect(
    new URL(`/admin?view=inbox&msg=${encodeURIComponent(flash)}`, req.url),
    303,
  );
}
