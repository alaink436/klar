// Admin-only approval endpoint for affiliate applications submitted via the
// public `<AffiliateForm>`. Authed with the same KLAR_ADMIN_KEY cookie that
// /admin uses.
//
// Flow:
//   1. Validate inputs (handle / code / commission charset + length)
//   2. Mint the influencer code in the chosen app's Supabase via
//      `admin_create_influencer_code` RPC (see migrations 0001 / 0002).
//   3. PATCH the originating `klar_inquiries` row in the anime-vault Supabase
//      with approved_app / approved_code / approved_at + status='approved'.
//   4. Redirect back to /admin?view=inbox so the row is visibly resolved.
//
// On failure (RPC reject, schema mismatch, network) the row is NOT touched —
// the admin sees the error and can retry. We never partial-commit.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { getApp, mintInfluencerCode } from "@/lib/adminApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KLAR_INBOX_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const KLAR_INBOX_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

const CODE_RE = /^[A-Z0-9_.-]{3,32}$/;
const HANDLE_RE = /^[A-Za-z0-9_.-]{1,64}$/;

function bad(message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function clampPct(raw: string): number {
  const n = parseFloat(raw);
  if (!isFinite(n) || n <= 0 || n > 1) return 0.5;
  return Math.round(n * 100) / 100;
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
  // Auth: same cookie /admin issues. No query-string fallback here — this is
  // a state-changing endpoint, the cookie is the canonical proof.
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return bad("admin not configured", 503);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
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
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const handle = String(form.get("handle") ?? "").trim();
  const displayName = String(form.get("display_name") ?? "").trim();
  const commissionPct = clampPct(String(form.get("commission_pct") ?? "0.5"));

  if (!inquiryId) return bad("missing inquiry_id");
  if (!CODE_RE.test(code)) return bad("code must match /^[A-Z0-9_.-]{3,32}$/");
  if (!HANDLE_RE.test(handle)) return bad("handle invalid");

  const app = getApp(appSlug);
  if (!app) return bad(`unknown app: ${appSlug}`);

  // 1) Mint in the app's Supabase. If this throws we abort BEFORE touching
  // the inbox row — keeps the flow re-runnable.
  try {
    await mintInfluencerCode(app, {
      code,
      handle,
      displayName: displayName || handle,
      commissionPct,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return bad(`mint failed: ${msg}`, 502);
  }

  // 2) Mark the inquiry as approved.
  try {
    await patchInquiry(inquiryId, {
      status: "approved",
      approved_app: appSlug,
      approved_code: code,
      approved_at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // The mint already happened — surface the error so the admin can
    // manually update the row, but don't pretend nothing happened.
    return NextResponse.json(
      {
        ok: false,
        partial: true,
        error: `mint succeeded but inquiry PATCH failed: ${msg}`,
        app: appSlug,
        code,
      },
      { status: 502 },
    );
  }

  // Redirect back to inbox so the row's new status is immediately visible.
  // Accept can override (so XHR clients can stay on a JSON path if needed).
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json({
      ok: true,
      app: appSlug,
      code,
      handle,
      commission_pct: commissionPct,
      landing_url: `https://getklar.org/i/${appSlug}/${code}`,
    });
  }
  return NextResponse.redirect(new URL("/admin?view=inbox", req.url), 303);
}
