// TEMPORARY debug endpoint — reports env-var presence only, no values
// returned. Safe to expose briefly because no secret content leaks
// (booleans + lengths + URL prefix + first/last 3 chars of probe/key).
// Removed once agreement-log + email pipeline is verified end-to-end.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const probe = new URL(req.url).searchParams.get("probe") ?? "";
  const adminKey = process.env.KLAR_AGREEMENT_ADMIN_KEY ?? "";

  return NextResponse.json({
    ok: true,
    deploy_marker: "a012604+envcheck-ungated",
    probe: {
      present: Boolean(probe),
      length: probe.length,
      first3: probe.slice(0, 3),
      last3: probe.slice(-3),
    },
    adminKey: {
      present: Boolean(adminKey),
      length: adminKey.length,
      first3: adminKey.slice(0, 3),
      last3: adminKey.slice(-3),
    },
    matches: Boolean(probe) && probe === adminKey,
    inbox: {
      KLAR_INBOX_SUPABASE_URL_present: Boolean(process.env.KLAR_INBOX_SUPABASE_URL),
      KLAR_INBOX_SUPABASE_URL_prefix: (process.env.KLAR_INBOX_SUPABASE_URL ?? "").slice(0, 35),
      KLAR_INBOX_SERVICE_KEY_present: Boolean(process.env.KLAR_INBOX_SERVICE_KEY),
      KLAR_INBOX_SERVICE_KEY_length: (process.env.KLAR_INBOX_SERVICE_KEY ?? "").length,
      KLAR_INBOX_SERVICE_KEY_starts_eyJ: (process.env.KLAR_INBOX_SERVICE_KEY ?? "").startsWith("eyJ"),
    },
    admin_apps: (() => {
      try {
        const arr = JSON.parse(process.env.KLAR_ADMIN_APPS ?? "[]");
        return Array.isArray(arr) ? arr.map((a: { slug?: string }) => a?.slug ?? "?") : [];
      } catch { return ["__parse_error__"]; }
    })(),
  });
}
