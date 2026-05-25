// POST /api/outreach/check-suppression
// Called by the n8n wave-consumer right before each Brevo Mail-1 send to
// filter targets that landed on the suppression list (STOP requests, bounces,
// manual admin entries, duplicate asks). Header-auth via X-Klar-Webhook-Secret
// to match the rest of the n8n webhook surface (S32 security pass).
//
// Request body:
//   { handles?: string[], platform?: "tiktok"|"instagram", emails?: string[] }
// Response:
//   { suppressed: SuppressionRow[], checked: { handles: number, emails: number } }

import { NextResponse, type NextRequest } from "next/server";
import { checkSuppressions } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.KLAR_N8N_WEBHOOK_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const got = req.headers.get("x-klar-webhook-secret") ?? "";
  if (!ctEqual(got, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { handles?: unknown; platform?: unknown; emails?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const handles = Array.isArray(body.handles)
    ? body.handles.filter((h): h is string => typeof h === "string").slice(0, 1000)
    : [];
  const emails = Array.isArray(body.emails)
    ? body.emails.filter((e): e is string => typeof e === "string").slice(0, 1000)
    : [];
  const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase() : "";
  const platform = platformRaw === "tiktok" || platformRaw === "instagram" ? platformRaw : undefined;

  if (handles.length === 0 && emails.length === 0) {
    return NextResponse.json({ suppressed: [], checked: { handles: 0, emails: 0 } });
  }

  try {
    const suppressed = await checkSuppressions({ handles, platform, emails });
    return NextResponse.json({
      suppressed,
      checked: { handles: handles.length, emails: emails.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "lookup_failed", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
