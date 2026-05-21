// n8n V3 Auto-on-Reply pipeline hook. Replaces the bare
// `create_influencer_setup` RPC call so we get one HTTP call that
// (a) mints the 7-day setup_token in the chosen app's Supabase via
// service-role from KLAR_ADMIN_APPS, and (b) inserts a klar_inquiries row
// in anime-vault tagged source='outreach-reply', status='invited' so the
// /admin?view=inbox table shows the influencer alongside the contact-form
// inbound + DM rows.
//
// Auth: X-Klar-Admin-Key header must match KLAR_ADMIN_KEY env (same key
// that gates /admin). n8n stores it as an n8n credential, never inline.
//
// Body (JSON):
//   { email, handle, app, displayName?, language?, share_pct?, share_months?,
//     mail1_subject? }
//
// Returns:
//   { ok: true, token, handle, landing_url, expires_at }

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual } from "@/app/admin/_shared";
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

async function insertInquiry(row: {
  type: string;
  email: string;
  handle: string;
  source: string;
  status: string;
  approved_app: string;
  approved_code: string;
  approved_at: string;
  why?: string;
}): Promise<{ id?: string } | null> {
  if (!KLAR_INBOX_KEY) {
    console.warn("[outreach-mint] KLAR_INBOX_SERVICE_KEY missing, klar_inquiries insert skipped");
    return null;
  }
  try {
    const res = await fetch(`${KLAR_INBOX_URL}/rest/v1/klar_inquiries`, {
      method: "POST",
      headers: {
        apikey: KLAR_INBOX_KEY,
        Authorization: `Bearer ${KLAR_INBOX_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[outreach-mint] inquiry insert ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    const rows = (await res.json().catch(() => null)) as Array<{ id?: string }> | null;
    return rows?.[0] ?? null;
  } catch (e) {
    console.warn("[outreach-mint] inquiry insert threw", e);
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return bad("admin not configured", 503);
  const provided = req.headers.get("x-klar-admin-key") ?? "";
  if (!provided || !ctEqual(provided, KEY)) return bad("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("bad json");
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const rawHandle = String(body.handle ?? "").trim().replace(/^@/, "");
  const handle = rawHandle.toLowerCase();
  const appSlug = String(body.app ?? "").trim();
  const displayName = String(body.displayName ?? body.display_name ?? "").trim();
  const language = String(body.language ?? "de").trim().toLowerCase();
  const sharePct = Math.round(Number(body.share_pct ?? 50));
  const shareMonths = Math.round(Number(body.share_months ?? 24));
  const mail1Subject = typeof body.mail1_subject === "string" ? body.mail1_subject.slice(0, 200) : null;

  if (!EMAIL_RE.test(email)) return bad("email invalid");
  if (!HANDLE_RE.test(handle)) return bad("handle invalid");
  if (!LANG_RE.test(language)) return bad("language invalid");
  if (!isFinite(sharePct) || sharePct <= 0 || sharePct > 100) return bad("share_pct out of range");
  if (!isFinite(shareMonths) || shareMonths <= 0 || shareMonths > 60) return bad("share_months out of range");

  const app = getApp(appSlug);
  if (!app) return bad(`unknown app: ${appSlug}`);

  // 1) Mint the setup token in the app's Supabase.
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
  const nowIso = new Date().toISOString();

  // 2) Mirror as a klar_inquiries row so the influencer surfaces in /admin
  // ?view=inbox alongside inbound + DM applications. Best-effort: if the
  // insert fails we still return ok=true with the token so n8n can finish
  // the mail-2 send (the influencer wouldn't notice the bookkeeping miss).
  await insertInquiry({
    type: "affiliate",
    email,
    handle,
    source: "outreach-reply",
    status: "invited",
    approved_app: appSlug,
    approved_code: setup.setup_token,
    approved_at: nowIso,
    ...(mail1Subject ? { why: `Outreach-Reply auf Mail-1 (Subject: ${mail1Subject})` } : {}),
  });

  return NextResponse.json({
    ok: true,
    token: setup.setup_token,
    handle: setup.handle,
    landing_url: landingUrl,
    expires_at: setup.setup_token_expires_at,
  });
}
