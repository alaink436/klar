// GET /api/cron/app-metrics — daily per-app metrics snapshot.
//
// Hit by the Vercel Cron in vercel.json. Records each connected app's user count
// (auth.users via klar_app_stats RPC) + RevenueCat revenue (MRR / 28d) into
// klar_app_metrics_daily in the Klar-hub, so the Apps analytics tab can draw a
// revenue time-series (RevenueCat itself only exposes a current snapshot).
//
// Auth: Vercel attaches `Authorization: Bearer $CRON_SECRET`; we require it,
// fail-closed (no secret => 401, nothing runs).

import { NextResponse, type NextRequest } from "next/server";
import { snapshotAllApps } from "@/lib/appMetrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const report = await snapshotAllApps(today);
  return NextResponse.json(report, { status: report.ok ? 200 : 500 });
}
