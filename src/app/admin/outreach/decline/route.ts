// POST /admin/outreach/decline — Reply ablehnen.
// Setzt status='declined' und legt optional eine Suppression-Row an, damit
// das Target in der nächsten Welle nicht erneut angeschrieben wird.

import { NextResponse, type NextRequest } from "next/server";
import { readCookie, ctEqual } from "../../_shared";
import {
  setOutreachStatus,
  addSuppression,
} from "../../../../lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin?view=outreach&msg=${encodeURIComponent(msg.slice(0, 400))}`, req.url),
    303,
  );
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

  const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || null;
  const addSup = String(form.get("suppress") ?? "") === "1";

  try {
    const row = await setOutreachStatus(id, "declined", {
      notes: reason ?? undefined,
    });

    let supMsg = "";
    if (addSup) {
      const platform: "tiktok" | "instagram" | "*" =
        row.platform === "tiktok" || row.platform === "instagram"
          ? row.platform
          : "*";
      try {
        await addSuppression({
          handle: row.handle,
          platform,
          reason: "manual",
          source: "admin-decline",
          email: row.contact_email ?? null,
          notes: reason ?? "via admin decline",
        });
        supMsg = " + suppression";
      } catch (e) {
        supMsg = ` (suppression fail: ${e instanceof Error ? e.message.slice(0, 80) : "err"})`;
      }
    }
    return back(req, `@${row.handle}: → declined${supMsg}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(req, `Decline fehlgeschlagen: ${msg.slice(0, 200)}`);
  }
}
