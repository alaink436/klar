// POST /admin/brain-invite
//
// Provisions (or revokes) an AI-Brain reader. Same 2FA gate as /admin/invite.
//
// action=invite (default):
//   1. ensure an auth.users row exists in the Klar Inbox project (so the
//      self-serve magic-link at /brain/login can find them — signInWithOtp
//      uses shouldCreateUser:false).
//   2. upsert the brain_members scope row (clearance + folder allow-list).
//   The person then signs in themselves at /brain/login; we deliberately do
//   NOT mint the magic link here because an admin-generated link has no PKCE
//   verifier in the visitor's browser, so the SSR callback couldn't exchange
//   it. Browser-initiated sign-in is the reliable path.
//
// action=revoke: stamp revoked_at so the /brain gate locks them out (the
// auth.users row is left intact — it may be shared with the affiliate app).

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { serviceSupabase } from "@/lib/supabaseAuth";
import { availableFolders } from "@/lib/brainVault";
import {
  upsertBrainMember,
  revokeBrainMember,
  type BrainClearance,
} from "@/lib/brainMembers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function back(req: NextRequest, params: Record<string, string>): Response {
  const url = new URL("/admin/settings", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) {
    return NextResponse.json({ ok: false, error: "admin not configured" }, { status: 503 });
  }
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/settings", req.url), 303);
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) {
    return NextResponse.redirect(new URL("/admin/login?next=/admin/settings", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, { err: "Formular ungültig." });
  }

  const action = String(form.get("action") ?? "invite");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return back(req, { err: "Email-Format ungültig." });
  }

  if (action === "revoke") {
    try {
      await revokeBrainMember(email);
      return back(req, { msg: `Brain-Zugang für ${email} entzogen.` });
    } catch (e) {
      return back(req, { err: e instanceof Error ? e.message : String(e) });
    }
  }

  // invite
  const clearance: BrainClearance = form.get("clearance") === "full" ? "full" : "brain";
  const validKeys = new Set(availableFolders().map((g) => g.key));
  const folders = form
    .getAll("folders")
    .map((f) => String(f))
    .filter((f) => validKeys.has(f));

  if (clearance === "brain" && folders.length === 0) {
    return back(req, { err: "Mindestens einen Bereich auswählen (oder Clearance 'Voll')." });
  }

  try {
    // 1. ensure the auth.users row exists (idempotent — ignore "already
    //    registered" so re-inviting an existing affiliate/member is fine).
    const sb = serviceSupabase();
    const { error: createErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr) {
      const msg = createErr.message.toLowerCase();
      const benign = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!benign) {
        return back(req, { err: `Auth-User: ${createErr.message}` });
      }
    }

    // 2. scope row
    await upsertBrainMember({ email, clearance, folders, invitedBy: device.name });

    const scopeText =
      clearance === "full" ? "voller Zugriff" : `Bereiche: ${folders.join(", ")}`;
    return back(req, {
      msg: `Brain-Zugang für ${email} erstellt (${scopeText}). Die Person meldet sich unter /brain/login mit dieser Email an.`,
    });
  } catch (e) {
    return back(req, { err: e instanceof Error ? e.message : String(e) });
  }
}
