// Cal.com webhook receiver. cal.getklar.org sends BOOKING_* events here,
// we verify HMAC-SHA256 against KLAR_CAL_WEBHOOK_SECRET and upsert into
// cal_bookings (anime-vault project, service-role key for RLS-bypass).
//
// The bookings are read by /admin to render the "Cal Bookings" widget.
//
// Cal.com signs the request body with HMAC-SHA256 and puts the hex digest
// in either `X-Cal-Signature-256` (newer) or `cal-signature-256` (lowercase).
// Both header variants are checked.

import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.KLAR_INBOX_SUPABASE_URL ??
  "https://exiuwektrqxvycclqfdd.supabase.co";

// Service-role key: server-only, RLS-bypass for cal_bookings write.
// Same env as the inbox view's read path (one key, two uses).
const SERVICE_KEY = process.env.KLAR_INBOX_SERVICE_KEY ?? "";

// Webhook signing secret: must match the one configured in Cal.com UI.
// Generated 2026-05-20, stored in Vercel env only. Never in repo.
const WEBHOOK_SECRET = process.env.KLAR_CAL_WEBHOOK_SECRET ?? "";

type Json = Record<string, unknown>;

const j = (body: Json, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function verifySignature(rawBody: string, headerSig: string | null): boolean {
  if (!WEBHOOK_SECRET || !headerSig) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  // Strip optional "sha256=" prefix some Cal versions add
  const got = headerSig.replace(/^sha256=/i, "").trim();
  if (expected.length !== got.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

interface CalAttendee {
  email?: string;
  name?: string;
}

interface CalPayload {
  uid?: string;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  attendees?: CalAttendee[];
  organizer?: { email?: string };
  eventTypeId?: number;
  type?: string;
  location?: string;
  status?: string;
  metadata?: Json;
}

interface CalEvent {
  triggerEvent?: string;
  createdAt?: string;
  payload?: CalPayload;
}

export async function POST(req: Request): Promise<Response> {
  if (!SERVICE_KEY) {
    console.error("cal-webhook: KLAR_INBOX_SERVICE_KEY not set");
    return j({ ok: false, error: "misconfigured" }, 500);
  }
  if (!WEBHOOK_SECRET) {
    console.error("cal-webhook: KLAR_CAL_WEBHOOK_SECRET not set");
    return j({ ok: false, error: "misconfigured" }, 500);
  }

  const rawBody = await req.text();
  const sig =
    req.headers.get("x-cal-signature-256") ??
    req.headers.get("cal-signature-256");
  if (!verifySignature(rawBody, sig)) {
    return j({ ok: false, error: "invalid_signature" }, 401);
  }

  let event: CalEvent;
  try {
    event = JSON.parse(rawBody) as CalEvent;
  } catch {
    return j({ ok: false, error: "bad_json" }, 400);
  }

  const p = event.payload ?? {};
  const calUid = typeof p.uid === "string" ? p.uid : null;
  if (!calUid) return j({ ok: false, error: "missing_uid" }, 400);

  const attendee = Array.isArray(p.attendees) && p.attendees.length ? p.attendees[0] : {};

  const row = {
    cal_uid: calUid,
    trigger_event: event.triggerEvent ?? "UNKNOWN",
    event_type_id: typeof p.eventTypeId === "number" ? p.eventTypeId : null,
    event_type_slug: typeof p.type === "string" ? p.type : null,
    title: typeof p.title === "string" ? p.title.slice(0, 500) : null,
    description: typeof p.description === "string" ? p.description.slice(0, 2000) : null,
    start_time: typeof p.startTime === "string" ? p.startTime : null,
    end_time: typeof p.endTime === "string" ? p.endTime : null,
    attendee_email: typeof attendee.email === "string" ? attendee.email.slice(0, 320) : null,
    attendee_name: typeof attendee.name === "string" ? attendee.name.slice(0, 200) : null,
    organizer_email: typeof p.organizer?.email === "string" ? p.organizer.email.slice(0, 320) : null,
    location: typeof p.location === "string" ? p.location.slice(0, 500) : null,
    status: typeof p.status === "string" ? p.status : null,
    metadata: p.metadata ?? null,
    raw_payload: event,
  };

  // Upsert on cal_uid: BOOKING_RESCHEDULED reuses the uid, BOOKING_CANCELLED
  // sets status=CANCELLED on the same row. We always keep the latest state.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cal_bookings?on_conflict=cal_uid`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    console.error("cal_bookings upsert failed", res.status, await res.text());
    return j({ ok: false, error: "store_failed" }, 502);
  }
  return j({ ok: true });
}

// Cal.com pings the endpoint with GET on save to validate. Respond 200.
export async function GET(): Promise<Response> {
  return j({ ok: true, endpoint: "cal-webhook" });
}
