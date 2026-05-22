// Receives affiliate/consulting submissions from the public site and writes
// them durably into Supabase (project "anime-vault", repurposed as the klar
// inbox store). Replaces the old fire-and-forget formsubmit.co email path,
// which had no persistence and a silent activation gate.
//
// Write path uses the ANON key with an INSERT-only RLS policy: the public
// surface cannot read, update or delete rows even if abused. The anon key is
// public by design (shipped in app bundles), so it is safe to ship here.
// Reading happens in /admin via a server-side service-role key (separate env).
//
// Hardening:
//   - 32 KB body cap, before reading the stream
//   - origin/referer must match our allowed-list (best-effort CSRF guard)
//   - per-IP rate-limit: 5 inserts / 10 min before we reject
//   - honeypot still active below, so even allowed clients can't spam

import {
  clientIp,
  exceedsContentLength,
  isAllowedOrigin,
  rateLimit,
} from "@/lib/apiGuards";
import { getAdminSettings, logNotifEvent } from "@/lib/adminSettings";
import { approveAffiliateCore } from "@/lib/affiliateApprove";
import { flushNotifsIfBatchReady } from "@/lib/notifFlusher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

const SUPABASE_URL =
  process.env.KLAR_INQUIRY_SUPABASE_URL ??
  "https://exiuwektrqxvycclqfdd.supabase.co";

// Public anon JWT (role=anon). Not a secret. Env override for portability.
const ANON_KEY =
  process.env.KLAR_INQUIRY_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4aXV3ZWt0cnF4dnljY2xxZmRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjkwMjQsImV4cCI6MjA4MTQwNTAyNH0.Xc5DaxyxdD0LW6nJqvV9eBAnV2yZYsGkWPLlmkRuKtE";

type Json = Record<string, unknown>;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const isEmail = (s: string): boolean =>
  s.length >= 3 && s.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  if (exceedsContentLength(req, MAX_BODY_BYTES))
    return json({ success: false, error: "too_large" }, 413);
  if (!isAllowedOrigin(req))
    return json({ success: false, error: "bad_origin" }, 403);
  const rl = rateLimit("inquiry", clientIp(req), 5, 10 * 60 * 1000);
  if (!rl.ok)
    return new Response(
      JSON.stringify({ success: false, error: "rate_limited" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      },
    );

  let payload: Json;
  try {
    payload = (await req.json()) as Json;
  } catch {
    return json({ success: false, error: "bad_json" }, 400);
  }

  // Honeypot: real users never fill "company" (hidden, aria-hidden field).
  // Bots that auto-fill every input get a fake 200 and are dropped.
  if (str(payload.company, 200)) return json({ success: true });

  const type = str(payload.type, 20);
  if (type !== "affiliate" && type !== "consulting" && type !== "coaching")
    return json({ success: false, error: "bad_type" }, 400);

  const email = str(payload.email, 320);
  if (!isEmail(email))
    return json({ success: false, error: "bad_email" }, 400);

  const row: Json = {
    type,
    email,
    status: "new",
    source: "getklar.org",
    user_agent: str(req.headers.get("user-agent"), 500) || null,
  };

  if (type === "affiliate") {
    row.handle = str(payload.handle, 200) || null;
    row.audience = str(payload.audience, 200) || null;
    row.platforms = str(payload.platforms, 300) || null;
    row.why = str(payload.why, 8000) || null;
    // Influencer's app pre-selection (optional). Validated against the
    // DB check-constraint klar_inquiries_target_app_chk — invalid values
    // get dropped silently rather than failing the whole insert.
    const rawTarget = str(payload.target_app, 40);
    const VALID_APPS = new Set([
      "trubel", "myloo", "wavelength", "yarn-stash", "kelva", "moto",
    ]);
    if (VALID_APPS.has(rawTarget)) row.target_app = rawTarget;
  } else {
    row.name = str(payload.name, 200) || null;
    row.project = str(payload.project, 200) || null;
    row.budget = str(payload.budget, 100) || null;
    row.brief = str(payload.brief, 8000) || null;
  }

  try {
    // We need the inserted row back so we can (a) reference its id when
    // auto-accept is on and (b) attach it to the notification log. Switch
    // from minimal to representation now that we read the row downstream.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/klar_inquiries`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
      cache: "no-store",
    });
    if (!res.ok) {
      // Log server-side for debugging; never leak DB internals to the client.
      console.error("klar_inquiries insert failed", res.status, await res.text());
      return json({ success: false, error: "store_failed" }, 502);
    }
    const inserted = (await res.json().catch(() => [])) as Array<{
      id?: string;
    }>;
    const inquiryId = Array.isArray(inserted) ? inserted[0]?.id ?? null : null;

    // Read admin settings once. Best-effort — getAdminSettings falls back to
    // defaults if the inbox project is unreachable, so a misconfig here
    // never blocks the public form.
    const settings = await getAdminSettings({ revalidate: 30 });

    // Append a notification event when the inquiry trigger is on. The
    // batcher reads admin_notif_log and sends a digest when pending count
    // crosses settings.notification_batch_size (handled in Phase 2c).
    if (settings.notification_trigger_inquiry) {
      // Log first, then attempt a flush. logNotifEvent is fire-and-forget
      // (best-effort PostgREST POST). Flush is also fire-and-forget — it
      // reads pending count, builds + sends digest if batch_size hit.
      void logNotifEvent({
        event_type: "inquiry_new",
        app_slug: typeof row.target_app === "string" ? row.target_app : null,
        handle: typeof row.handle === "string" ? row.handle : null,
        inquiry_id: inquiryId,
        payload: { type, email },
      }).then(() => flushNotifsIfBatchReady());
    }

    // Auto-accept: only for affiliate-type inquiries that have a
    // target_app + handle. If any required field is missing the inquiry
    // stays in the inbox for manual approve — we never approve without
    // enough data to mint a setup token.
    if (
      settings.auto_accept_affiliates &&
      type === "affiliate" &&
      inquiryId &&
      typeof row.target_app === "string" &&
      typeof row.handle === "string" &&
      row.handle
    ) {
      const handle = String(row.handle).replace(/^@/, "").toLowerCase();
      // Don't await — the approve flow makes 2-3 round-trips (RPC, PATCH,
      // Brevo) and we don't want to block the form submission on it. The
      // user just needs to know their inquiry landed.
      void approveAffiliateCore({
        inquiryId,
        appSlug: row.target_app,
        handle,
        email,
        displayName: handle,
        language: "de",
        sharePct: 50,
        shareMonths: 24,
      }).catch((e) => {
        console.error("[inquiry] auto-accept failed", e);
      });
    }

    return json({ success: true });
  } catch (e) {
    console.error("klar_inquiries insert threw", e);
    return json({ success: false, error: "network" }, 502);
  }
}
