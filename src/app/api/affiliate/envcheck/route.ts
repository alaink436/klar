// TEMPORARY debug endpoint — reports env-var presence only, no values
// returned. Safe to expose briefly because no secret content leaks
// (booleans + lengths + URL prefix + first/last 3 chars of probe/key).
// Removed once agreement-log + email pipeline is verified end-to-end.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const probe = params.get("probe") ?? "";
  const adminKey = process.env.KLAR_AGREEMENT_ADMIN_KEY ?? "";
  const serviceKey = process.env.KLAR_INBOX_SERVICE_KEY ?? "";
  const inboxUrl = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";

  // Optional: when ?send=<contact_email> is passed AND probe matches adminKey,
  // we fire a synchronous call to the confirmation-email edge function with
  // a stub payload and return the raw Brevo status/body so we can diagnose
  // why the function 502s in prod.
  const sendTo = params.get("send");
  if (sendTo && probe === adminKey && adminKey) {
    try {
      const res = await fetch(`${inboxUrl}/functions/v1/affiliate-confirmation-email`, {
        method: "POST",
        headers: {
          "x-admin-key": adminKey,
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_slug: "yarn-stash",
          app_name: "Yarn-Stash",
          handle: "envcheck-probe",
          display_name: "Envcheck Probe",
          contact_email: sendTo,
          promo_code: "PROBE20",
          tracking_url: "https://getklar.org/i/yarnstash/PROBE20",
          commission_pct: 50,
          attribution_months: 24,
          assets_drive_url: null,
          agreement_version: "v1.0-2026-05-21",
          signed_at: new Date().toISOString(),
        }),
      });
      const body = await res.text();
      return NextResponse.json({
        edge_call: {
          status: res.status,
          body: body.slice(0, 1200),
        },
      });
    } catch (e) {
      return NextResponse.json({
        edge_call: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

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
