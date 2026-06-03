// GET /admin/brain/note?path=<vault-relative .md>
//
// Note-body proxy for the admin AI-Brain viewer. Same 2FA gate as the rest
// of /admin (device cookie + admin key). Admin has full scope (allowed=null)
// but the secret-folder guard inside fetchNote() still applies, so Secrets/
// Credentials can never be pulled even by the admin. The GitHub token stays
// server-side.

import { NextResponse, type NextRequest } from "next/server";
import { ctEqual, readCookie } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { fetchNote } from "@/lib/brainVault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) {
    return NextResponse.json({ error: "admin not configured" }, { status: 503 });
  }
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const device = await verifyDeviceCookie(readCookie(req, "klar_device"), DEV);
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const path = new URL(req.url).searchParams.get("path") ?? "";
  const note = await fetchNote(path, null);
  if (!note.ok) {
    return NextResponse.json({ error: note.error }, { status: note.status });
  }
  return NextResponse.json({ text: note.text, name: note.name });
}
