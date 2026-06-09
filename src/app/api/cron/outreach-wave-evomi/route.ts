// GET /api/cron/outreach-wave-evomi — SCALE-PATH STUB (not used for the trial).
//
// The trial Evomi wave is single-shot (admin button -> /admin/outreach/wave-evomi).
// This cron is the future scale path that drains a klar_wave_candidates queue N
// handles per tick; until that queue model is built, it is a no-op stub that just
// confirms the auth gate works. Registered in vercel.json only when the queue path
// ships (the orchestrator wires the cron entry, not this task).
//
// Auth mirrors cron/outreach-mail/route.ts: Vercel attaches
// `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set; fail-closed
// (no secret => 401, nothing runs).

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, note: "scale-path stub" });
}
