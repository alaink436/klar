// GET /api/cron/creator-model — daily estimate of what creators without a link
// brought (lib/creatorModelRun), plus the weekly report to Alain on Mondays.
//
// Hit by the Vercel Cron in vercel.json, after app-metrics. Auth like
// app-metrics: `Authorization: Bearer $CRON_SECRET`, fail-closed.

import { NextResponse, type NextRequest } from "next/server";
import { runCreatorModel } from "@/lib/creatorModelRun";
import { sendWeeklyReport } from "@/lib/creatorReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const run = await runCreatorModel().catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  const report = run.ok && new Date().getUTCDay() === 1 ? await sendWeeklyReport() : false;
  return NextResponse.json({ ...run, report }, { status: run.ok ? 200 : 500 });
}
