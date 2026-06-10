// POST /admin/outreach/wave-evomi — n8n-free Evomi trial wave (DRY-RUN default).
//   - dry-run by default; COMMIT when body.commit===true or ?commit=1
//   - returns application/json (the report), NOT a 303 redirect, so the admin UI
//     can render the would-be rows + counts.
// DELETE /admin/outreach/wave-evomi — cleanup: delete all trial rows
//   (niche LIKE 'evomi-trial%'), returns the deleted count.
//
// Auth: STRICT gate = verifyDeviceCookie(klar_device) AND ctEqual(klar_admin),
// mirroring scrape-settings/route.ts. This route can spend Apify+Evomi credits and
// write DB rows, so it uses the stronger device+session gate (not admin-cookie only).
// Input validation mirrors start/route.ts (LIVE app whitelist, platform/bucket/lang
// whitelists), but single-app and trial-clamped count 1..5.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { verifyDeviceCookie } from "../../../../lib/deviceCookie";
import { KLAR_APPS } from "../../../../lib/klarApps";
import { runEvomiWave, type WavePlatform } from "../../../../lib/waveEvomi";
import { deleteTrialTargets } from "../../../../lib/outreachStore";
import type { SizeBucket } from "../../../../lib/sizeBuckets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby ceiling — keep trial counts small (1-5)

const COUNT_MIN = 1;
const COUNT_MAX = 5; // trial hard cap
const NICHE_MAX = 80;
const ALLOWED_BUCKETS = new Set<SizeBucket>(["nano", "micro", "mid", "macro"]);
const ALLOWED_LANGS = new Set(["de", "en", "es", "it", "fr"]);

function login(req: NextRequest): Response {
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}

function bad(msg: string): Response {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

/** Authorized via EITHER a machine token OR the strict device+admin gate.
 *  Returns null when authorized, else a 401/redirect response.
 *
 *  Path A (machine): `Authorization: Bearer <WAVE_TRIAL_TOKEN>` — lets an operator
 *  or agent run dry-runs/cleanup without a 2FA browser session. Constant-time
 *  compared; only active when the env var is set.
 *  Path B (human UI): HMAC device cookie + admin session (mirror of scrape-settings). */
async function gate(req: NextRequest): Promise<Response | null> {
  const TOKEN = process.env.WAVE_TRIAL_TOKEN ?? "";
  if (TOKEN) {
    const m = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") ?? "").trim());
    if (m && ctEqual(m[1].trim(), TOKEN)) return null;
  }
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) return login(req);
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) return login(req);
  return null;
}

interface RawBody {
  app?: unknown;
  platforms?: unknown;
  size_buckets?: unknown;
  niche?: unknown;
  count?: unknown;
  language?: unknown;
  hashtags?: unknown;
  commit?: unknown;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await gate(req);
  if (denied) return denied;

  let body: RawBody;
  try {
    body = (await req.json()) as RawBody;
  } catch {
    return bad("Bad JSON body");
  }

  // app: single LIVE slug.
  const liveSlugs = new Set(KLAR_APPS.filter((a) => a.status === "LIVE").map((a) => a.slug));
  const app = String(body.app ?? "").trim().toLowerCase();
  if (!app || !liveSlugs.has(app)) return bad("Eine LIVE-App auswählen");

  // platforms.
  const platforms = Array.from(
    new Set(asStringArray(body.platforms).filter((p) => p === "tiktok" || p === "instagram")),
  ) as WavePlatform[];
  if (platforms.length === 0) return bad("Mindestens eine Plattform auswählen");

  // size_buckets.
  const sizeBuckets = Array.from(
    new Set(asStringArray(body.size_buckets).filter((b) => ALLOWED_BUCKETS.has(b as SizeBucket))),
  ) as SizeBucket[];
  if (sizeBuckets.length === 0) return bad("Mindestens eine Größe auswählen");

  // language: single, default 'de'.
  const langRaw = String(body.language ?? "de").trim().toLowerCase();
  const language = ALLOWED_LANGS.has(langRaw) ? langRaw : "de";

  // count clamp 1..5.
  const countNum = Number(body.count);
  const count = Number.isFinite(countNum)
    ? Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(countNum)))
    : COUNT_MIN;

  const niche = String(body.niche ?? "").trim().slice(0, NICHE_MAX) || null;

  const hashtags =
    Array.isArray(body.hashtags) && body.hashtags.length > 0
      ? body.hashtags.map((h) => String(h).trim()).filter(Boolean)
      : undefined;

  // commit: body flag OR ?commit=1 query.
  const queryCommit = new URL(req.url).searchParams.get("commit") === "1";
  const commit = body.commit === true || queryCommit;

  const report = await runEvomiWave(
    { app, platforms, size_buckets: sizeBuckets, niche, count, language, hashtags },
    { commit },
  );
  return NextResponse.json(report, { status: report.ok ? 200 : 502 });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await gate(req);
  if (denied) return denied;
  try {
    const { deleted } = await deleteTrialTargets();
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) }, { status: 502 });
  }
}
