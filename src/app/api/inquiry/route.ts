// Receives affiliate/consulting submissions from the public site and writes
// them durably into Supabase (project "anime-vault", repurposed as the klar
// inbox store). Replaces the old fire-and-forget formsubmit.co email path,
// which had no persistence and a silent activation gate.
//
// Write path uses the ANON key with an INSERT-only RLS policy: the public
// surface cannot read, update or delete rows even if abused. The anon key is
// public by design (shipped in app bundles), so it is safe to ship here.
// Reading happens in /admin via a server-side service-role key (separate env).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  } else {
    row.name = str(payload.name, 200) || null;
    row.project = str(payload.project, 200) || null;
    row.budget = str(payload.budget, 100) || null;
    row.brief = str(payload.brief, 8000) || null;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/klar_inquiries`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      cache: "no-store",
    });
    if (!res.ok) {
      // Log server-side for debugging; never leak DB internals to the client.
      console.error("klar_inquiries insert failed", res.status, await res.text());
      return json({ success: false, error: "store_failed" }, 502);
    }
    return json({ success: true });
  } catch (e) {
    console.error("klar_inquiries insert threw", e);
    return json({ success: false, error: "network" }, 502);
  }
}
