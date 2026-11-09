// GET /api/cron/own-views/<1-4>: reads the views of our own TikTok posts through Evomi (lib/ownViews), ties the
// routines' drafts to them (lib/routines) and starts the creators' Apify run (lib/postViews.runCreatorClock).
//
// Four Vercel crons in vercel.json, one per slot, because Hobby runs each cron at most once a day (measured in
// Vercel's docs on 2026-11-09); the slot only tells the runs apart in the logs. Auth like the other crons:
// `Authorization: Bearer $CRON_SECRET`, fail-closed, compared in constant time.

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readOwnViews } from "@/lib/ownViews";
import { runCreatorClock } from "@/lib/postViews";
import { listRoutines, matchRoutinePosts } from "@/lib/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slot: string }> }): Promise<Response> {
  const SECRET = process.env.CRON_SECRET ?? "";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${SECRET}`);
  if (!SECRET || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { slot } = await ctx.params;
  const handles = [...new Set((await listRoutines()).flatMap((r) => r.accounts.map((a) => a.handle.toLowerCase())))];
  const read = await readOwnViews(handles);
  const matched = await matchRoutinePosts().catch(() => 0);
  const clock = await runCreatorClock().catch(() => null);
  return NextResponse.json({ ok: read.stored, slot, ...read, matched, clock }, { status: read.stored ? 200 : 502 });
}
