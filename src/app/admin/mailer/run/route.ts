// POST /admin/mailer/run — manual trigger for the outreach mailer.
//
// Called by the Mailer admin page (fetch, JSON in/out). Lets the admin preview
// (dryRun:true) who would receive Mail-1/Mail-2 with the rendered subject, then
// send for real (dryRun:false) — still gated by KLAR_OUTREACH_SENDER === "on"
// in the mailer, so a misclick before go-live sends nothing.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { runOutreachMailer, type MailerScope } from "@/lib/outreachMailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY || !ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let b: { scope?: string; delayDays?: number; cap?: number; dryRun?: boolean } = {};
  try {
    b = (await req.json()) as typeof b;
  } catch {
    /* defaults below */
  }

  const scope: MailerScope = (["mail1", "mail2", "both"] as const).includes(
    b.scope as MailerScope,
  )
    ? (b.scope as MailerScope)
    : "both";
  const delayDays = Number(b.delayDays);
  const cap = Number(b.cap);

  const report = await runOutreachMailer({
    scope,
    delayDays: isFinite(delayDays) ? delayDays : undefined,
    cap: isFinite(cap) ? cap : undefined,
    dryRun: b.dryRun !== false, // anything but an explicit false stays a dry run
  });
  return NextResponse.json({ ok: true, report });
}
