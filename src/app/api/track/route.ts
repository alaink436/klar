// Privacy-friendly visitor beacon for getklar.org.
//
// Receives POSTs from the AnalyticsTracker client component on every
// pageview. Writes a row into klar_pageviews (anime-vault Supabase) via
// service-role key. No cookies, no PII. session_hash is sha256(daily salt
// + ip + user-agent) so a session is implicit-pseudonymous and rotates
// daily without the visitor noticing.
//
// Fail-silent on every error path: tracking must never block a pageview.
// Skips /admin and /api paths (admin shouldn't track itself).
//
// Env: KLAR_INBOX_SUPABASE_URL (default anime-vault), KLAR_INBOX_SERVICE_KEY
//      (same key the inbox view reads with), KLAR_TRACKING_SALT (optional;
//      falls back to KLAR_ADMIN_KEY which is already secret).

import { createHash } from "node:crypto";
import {
  clientIp,
  exceedsContentLength,
  isAllowedOrigin,
  rateLimit,
} from "@/lib/apiGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024;

const SUPABASE_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const SERVICE_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const SALT = process.env.KLAR_TRACKING_SALT ?? process.env.KLAR_ADMIN_KEY ?? "";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function trim(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

// Compact "Family / OS" string, no version chaos. Best-effort.
function uaFamily(ua: string): string | null {
  if (!ua) return null;
  let browser = "Other";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/OPR\/|Opera\//.test(ua)) browser = "Opera";
  let os = "Other";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return `${browser} / ${os}`;
}

function dailySalt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return sha256(`${SALT}|${today}`);
}

export async function POST(req: Request): Promise<Response> {
  if (!SERVICE_KEY || !SALT) {
    // Misconfigured. Don't break the visitor, just no-op.
    return new Response(null, { status: 204 });
  }

  // Drop anything that didn't come from our own pages and anything obviously
  // oversized. Both are silent (204) on purpose — we never want to surface
  // analytics errors to the visitor.
  if (exceedsContentLength(req, MAX_BODY_BYTES))
    return new Response(null, { status: 204 });
  if (!isAllowedOrigin(req)) return new Response(null, { status: 204 });

  // Cheap-flood guard: cap a single client to 60 pageviews / minute. Real
  // humans burst nowhere near this; bots that get past the UA filter below
  // can still try, but they won't bloat klar_pageviews.
  const ip = clientIp(req);
  const rl = rateLimit("track", ip, 60, 60 * 1000);
  if (!rl.ok) return new Response(null, { status: 204 });

  let body: { path?: unknown; referrer?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const path = trim(typeof body.path === "string" ? body.path : "", 200);
  if (!path || path.startsWith("/admin") || path.startsWith("/api")) {
    return new Response(null, { status: 204 });
  }
  const referrer = trim(typeof body.referrer === "string" ? body.referrer : "", 200);

  const ua = req.headers.get("user-agent") ?? "";
  // Block obvious bots; they bloat the table without telling us anything useful.
  if (/bot|crawler|spider|preview|prerender|headless/i.test(ua)) {
    return new Response(null, { status: 204 });
  }

  const country = trim(req.headers.get("x-vercel-ip-country"), 4);
  const sessionHash = sha256(`${dailySalt()}|${ip}|${ua}`).slice(0, 32);
  const family = uaFamily(ua);

  // Fire-and-forget. waitUntil isn't available outside edge runtime here, so
  // we await with a short timeout to keep latency bounded.
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 1500);
    await fetch(`${SUPABASE_URL}/rest/v1/klar_pageviews`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        path,
        referrer,
        country,
        session_hash: sessionHash,
        ua_family: family,
      }),
      cache: "no-store",
      signal: ac.signal,
    });
    clearTimeout(t);
  } catch {
    // swallow
  }
  return new Response(null, { status: 204 });
}
