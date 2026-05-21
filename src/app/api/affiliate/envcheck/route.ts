// TEMPORARY debug endpoint — only reports whether env vars are *present*
// in the prod runtime, never the values themselves. Removed once the
// agreement-log + email pipeline is verified end-to-end.
//
// GET /api/affiliate/_envcheck?probe=<KLAR_AGREEMENT_ADMIN_KEY>
//
// The query param must match KLAR_AGREEMENT_ADMIN_KEY exactly, otherwise
// the endpoint returns 404. This means only someone who already knows
// the admin key (i.e. the user who set it in Vercel) can use this probe.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const probe = new URL(req.url).searchParams.get("probe") ?? "";
  const adminKey = process.env.KLAR_AGREEMENT_ADMIN_KEY ?? "";
  if (!probe || !adminKey || probe !== adminKey) {
    return new NextResponse("not found", { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    runtime: {
      KLAR_INBOX_SUPABASE_URL: Boolean(process.env.KLAR_INBOX_SUPABASE_URL),
      KLAR_INBOX_SUPABASE_URL_value_prefix: (process.env.KLAR_INBOX_SUPABASE_URL ?? "").slice(0, 30),
      KLAR_INBOX_SERVICE_KEY: Boolean(process.env.KLAR_INBOX_SERVICE_KEY),
      KLAR_INBOX_SERVICE_KEY_length: (process.env.KLAR_INBOX_SERVICE_KEY ?? "").length,
      KLAR_INBOX_SERVICE_KEY_starts_with_eyJ: (process.env.KLAR_INBOX_SERVICE_KEY ?? "").startsWith("eyJ"),
      KLAR_AGREEMENT_ADMIN_KEY: Boolean(process.env.KLAR_AGREEMENT_ADMIN_KEY),
      KLAR_AGREEMENT_ADMIN_KEY_length: (process.env.KLAR_AGREEMENT_ADMIN_KEY ?? "").length,
      KLAR_ADMIN_APPS_count: (() => { try { return JSON.parse(process.env.KLAR_ADMIN_APPS ?? "[]").length; } catch { return -1; } })(),
      deploy_marker: "1614877+envcheck",
    },
  });
}
