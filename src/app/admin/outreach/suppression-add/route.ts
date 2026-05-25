// POST /admin/outreach/suppression-add
// Manual add of a single suppression-row from the admin-UI mini-form.
// Auth via klar_admin cookie (mirror of the other admin/outreach/* routes).

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import { addSuppression, type SuppressionReason } from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REASONS = new Set<SuppressionReason>([
  "stop_request",
  "bounce",
  "spam_complaint",
  "manual",
  "opted_out",
  "invalid",
  "double_ask",
]);

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=outreach&msg=${encodeURIComponent(msg.slice(0, 300))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  if (!KEY) return back(req, "Server misconfigured: KLAR_ADMIN_KEY missing");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.redirect(new URL("/admin/login", req.url), 303);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Bad form");
  }

  const handleRaw = String(form.get("handle") ?? "").trim();
  const handle = handleRaw.replace(/^@+/, "").toLowerCase();
  if (handle.length < 1 || handle.length > 80) return back(req, "Handle ungültig");

  const platformRaw = String(form.get("platform") ?? "").toLowerCase();
  const platform: "tiktok" | "instagram" | "*" =
    platformRaw === "tiktok" ? "tiktok"
    : platformRaw === "instagram" ? "instagram"
    : "*";

  const reasonRaw = String(form.get("reason") ?? "manual") as SuppressionReason;
  const reason: SuppressionReason = ALLOWED_REASONS.has(reasonRaw) ? reasonRaw : "manual";

  const email = String(form.get("email") ?? "").trim().toLowerCase() || null;
  const notes = String(form.get("notes") ?? "").trim().slice(0, 500) || null;

  try {
    const row = await addSuppression({
      handle,
      platform,
      reason,
      source: "admin",
      email,
      notes,
    });
    return back(req, `Suppression gesetzt: @${row.handle} (${row.platform}, ${row.reason})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Suppression-Add fehlgeschlagen: ${msg.slice(0, 200)}`);
  }
}
