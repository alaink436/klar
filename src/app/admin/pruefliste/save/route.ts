// POST /admin/pruefliste/save: Alains Entscheid zu einem Post der Pruefliste.
// "approve" zaehlt, "own_content" oder "false_claims" lehnt ab (ein Verstoss).
// Siehe src/lib/postCheck.ts.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "@/lib/adminGuard";
import { reviewPost } from "@/lib/postCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;
  const form = await req.formData().catch(() => null);
  const post = String(form?.get("post") ?? "");
  const decision = String(form?.get("decision") ?? "");
  const res =
    decision === "approve"
      ? await reviewPost(post, "approve")
      : decision === "own_content" || decision === "false_claims"
        ? await reviewPost(post, "reject", decision)
        : { ok: false as const, msg: "Unbekannte Aktion" };
  revalidatePath("/admin/pruefliste");
  const key = res.ok ? "msg" : "err";
  return NextResponse.redirect(new URL(`/admin/pruefliste?${key}=${encodeURIComponent(res.msg)}`, req.url), 303);
}
