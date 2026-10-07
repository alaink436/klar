// GET /admin/brain/note?path=<vault-relative .md>
//
// Note-body proxy for the admin AI-Brain viewer. Same 2FA gate as the rest
// of /admin (device cookie + admin key). Admin has full scope (allowed=null)
// but the secret-folder guard inside fetchNote() still applies, so Secrets/
// Credentials can never be pulled even by the admin. The GitHub token stays
// server-side.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/adminGuard";
import { fetchNote } from "@/lib/brainVault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req);
  if (!auth.ok) return auth.response;

  const path = new URL(req.url).searchParams.get("path") ?? "";
  const note = await fetchNote(path, null);
  if (!note.ok) {
    return NextResponse.json({ error: note.error }, { status: note.status });
  }
  return NextResponse.json({ text: note.text, name: note.name });
}
