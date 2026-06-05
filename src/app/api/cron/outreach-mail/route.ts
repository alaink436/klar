// GET /api/cron/outreach-mail — scheduled Mail-1 / Mail-2 sender.
//
// Hit by the Vercel Cron defined in vercel.json. Vercel attaches
// `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set; we
// require and verify it, fail-closed (no secret set => 401, nothing runs).
//
// Real sends are still gated by KLAR_OUTREACH_SENDER === "on" inside the mailer
// (dryRun:false here only means "not a manual preview"). Adjust cadence by
// editing the cron `schedule` in vercel.json; adjust behaviour via the envs
// KLAR_MAIL2_DELAY_DAYS and KLAR_OUTREACH_DAILY_CAP.

import { NextResponse, type NextRequest } from "next/server";
import { runOutreachMailer } from "@/lib/outreachMailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const report = await runOutreachMailer({ scope: "both", dryRun: false });
  return NextResponse.json({ ok: true, report });
}
