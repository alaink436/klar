// POST /dashboard/kit/new: "Make me a new one" in the kit, the next version of one format for the signed-in
// creator (lib/creatorKit newVariant), back to the kit with the outcome. A paused or closed account gets none.

import { NextResponse } from "next/server";
import { getCreatorAccount } from "@/lib/creatorAccounts";
import { newVariant } from "@/lib/creatorKit";
import { getSessionUser } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/dashboard/login", req.url), { status: 303 });
  const account = await getCreatorAccount(user.id);
  const form = await req.formData().catch(() => null);
  const format = String(form?.get("format") ?? "");
  const paused = !!account?.suspended_until && new Date(account.suspended_until) > new Date();
  const result = account?.verified_at && !paused && !account.closed_at && format ? await newVariant(account.id, format) : "no_format";
  return NextResponse.redirect(new URL(`/dashboard?new=${result}#kit`, req.url), { status: 303 });
}
