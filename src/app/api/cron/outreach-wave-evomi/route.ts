// GET /api/cron/outreach-wave-evomi — drains the Evomi candidate queue.
//
// Trigger: an EXTERNAL scheduler hits this endpoint (the Klar Vercel project is on
// the Hobby plan — max 2 cron jobs, daily-only granularity — so the queue drain is
// pinged by an n8n 5-min heartbeat / cron-job.org instead of a Vercel cron). On
// Vercel Pro this can move back to a native `*/5 * * * *` entry in vercel.json.
//
// Each tick claims a bounded batch of pending klar_wave_candidates, enriches them
// HYBRID (TikTok→Evomi, IG→Apify profile scraper) in PARALLEL, inserts LIVE
// mailable targets, and finalizes any run whose queue is fully drained. Idempotent
// + chunked: a real-size wave drains over several ticks, each within the 60s Hobby
// function limit. No-op (claimed:0) when the queue is empty. A tick that is killed
// mid-flight loses nothing — claimed-but-unfinished candidates are reclaimed by the
// stale-reaper on a later tick.
//
// Only does work for waves started while scrape_settings.wave_backend='evomi'
// (those are the only ones that enqueue candidates). The legacy n8n path is
// untouched.
//
// Auth mirrors cron/outreach-mail/route.ts: the scheduler sends
// `Authorization: Bearer $CRON_SECRET`; fail-closed (no secret => 401).

import { NextResponse, type NextRequest } from "next/server";
import { drainEvomiQueue } from "../../../../lib/waveEvomiQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby function ceiling

export async function GET(req: NextRequest): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await drainEvomiQueue();
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg.slice(0, 300) }, { status: 500 });
  }
}
