// POST /admin/outreach/update-metrics — setzt follower_estimate / total_views_estimate /
// avg_views_per_post / engagement_rate_pct für einen Target. Form-Felder leer = null.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { updateMetrics } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=outreach&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
}

function parseNumOrNull(raw: unknown, max: number): number | null | "bad" {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!isFinite(n) || n < 0 || n > max) return "bad";
  return n;
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form");
  }

  const id = String(form.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return back(req, "id ungültig");

  const follower = parseNumOrNull(form.get("follower_estimate"), 100_000_000);
  const totalViews = parseNumOrNull(form.get("total_views_estimate"), 100_000_000_000);
  const avgViews = parseNumOrNull(form.get("avg_views_per_post"), 100_000_000);
  const engagement = parseNumOrNull(form.get("engagement_rate_pct"), 100);

  if (follower === "bad")    return back(req, "follower_estimate ungültig");
  if (totalViews === "bad")  return back(req, "total_views_estimate ungültig");
  if (avgViews === "bad")    return back(req, "avg_views_per_post ungültig");
  if (engagement === "bad")  return back(req, "engagement_rate_pct ungültig (0-100)");

  try {
    const row = await updateMetrics(id, {
      follower_estimate: follower as number | null,
      total_views_estimate: totalViews as number | null,
      avg_views_per_post: avgViews as number | null,
      engagement_rate_pct: engagement as number | null,
    });
    return back(req, `Metriken @${row.handle} aktualisiert`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `update-metrics failed: ${msg.slice(0, 120)}`);
  }
}
