// Renders the affiliate agreement PDF on demand and returns it for download.
// Called from the onboarding sign step so the affiliate can grab a copy of the
// exact contract they are signing, stamped with their typed name, the date and
// the agreement version. No DB writes happen here: it is a pure render of the
// data the client already holds. The signed copy that is persisted server-side
// is produced by /api/affiliate/complete with the same renderer.

import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_ORIGINS, isAllowedOrigin, clientIp, rateLimit, exceedsContentLength } from "@/lib/apiGuards";
import { getTrackingUrl, type BrandKey } from "@/app/affiliate/_shared/brands";
import { AGREEMENT_VERSION, BRAND_TO_APP, APP_META } from "@/lib/affiliateApps";
import { renderAgreementPdf, agreementPdfFilename } from "@/lib/affiliateAgreementPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024;
const RATE_MAX = 20;
const RATE_WINDOW_MS = 10 * 60_000; // 20 PDF renders / 10 min / IP

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://getklar.org";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

function bad(req: NextRequest, message: string, status = 400): Response {
  return NextResponse.json({ ok: false, error: message }, { status, headers: corsHeaders(req.headers.get("origin")) });
}

function slugifyHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_.-]/g, "") || "creator";
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!isAllowedOrigin(req)) return bad(req, "forbidden origin", 403);
  if (exceedsContentLength(req, MAX_BYTES)) return bad(req, "payload too large", 413);
  const rl = rateLimit("affiliate-agreement-pdf", clientIp(req), RATE_MAX, RATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, {
      status: 429,
      headers: { ...corsHeaders(req.headers.get("origin")), "Retry-After": String(rl.retryAfterSeconds) },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad(req, "bad json");
  }

  const brand = String(payload.brand ?? "").trim() as BrandKey;
  const appSlug = BRAND_TO_APP[brand];
  const meta = appSlug ? APP_META[appSlug] : undefined;
  if (!appSlug || !meta) return bad(req, "invalid brand");

  const displayName = String(payload.display_name ?? "").trim();
  const signerName = String(payload.signer_name ?? "").trim();
  const contactEmail = String(payload.contact_email ?? "").trim();
  const handle = slugifyHandle(String(payload.handle ?? ""));

  if (displayName.length < 2) return bad(req, "missing display_name");
  if (signerName.length < 2 || signerName.length > 120) return bad(req, "invalid signer_name");

  const signedAt = new Date().toISOString();
  const trackingUrl = getTrackingUrl(brand, handle);

  let bytes: Uint8Array;
  try {
    bytes = await renderAgreementPdf({
      app_name: meta.appName,
      handle,
      display_name: displayName,
      contact_email: contactEmail || "-",
      tracking_url: trackingUrl,
      commission_pct: meta.commissionPct,
      attribution_months: meta.attributionMonths,
      agreement_version: AGREEMENT_VERSION,
      signed_at: signedAt,
      language: "en",
      signer_name: signerName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[affiliate/agreement-pdf] render failed", msg);
    return bad(req, "pdf render failed", 500);
  }

  const filename = agreementPdfFilename(appSlug, handle, signedAt, "en");
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...corsHeaders(req.headers.get("origin")),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
