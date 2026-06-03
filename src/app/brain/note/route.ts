// GET /brain/note?path=<vault-relative .md>
//
// Note-body proxy for invited brain members. Resolves the Supabase session,
// looks up the member's clearance, and fetches the note with that scope so a
// 'brain' member can never read a note outside their allowed folders (and no
// one reads Secrets/Credentials — enforced in fetchNote). GitHub token stays
// server-side.

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/supabaseAuth";
import { getBrainMember, scopeForMember, touchBrainMemberSeen } from "@/lib/brainMembers";
import { fetchNote } from "@/lib/brainVault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getSessionUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const member = await getBrainMember(email);
  if (!member || member.revoked_at) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const path = new URL(req.url).searchParams.get("path") ?? "";
  const note = await fetchNote(path, scopeForMember(member));
  if (!note.ok) {
    return NextResponse.json({ error: note.error }, { status: note.status });
  }
  void touchBrainMemberSeen(email);
  return NextResponse.json({ text: note.text, name: note.name });
}
