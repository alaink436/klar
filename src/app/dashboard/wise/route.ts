// POST /dashboard/wise: the signed-in creator's Wise email and name for his
// payouts (lib/payouts saveWiseDetails), back to the dashboard. The first time
// only with the creator terms ticked; later changes don't ask again.

import { NextResponse } from "next/server";
import { getCreatorAccount } from "@/lib/creatorAccounts";
import { saveWiseDetails } from "@/lib/payouts";
import { getSessionUser } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/dashboard/login", req.url), { status: 303 });
  const account = await getCreatorAccount(user.id);
  const form = await req.formData().catch(() => null);
  const terms = form?.get("terms") === "on";
  if (account?.verified_at && form && (account.terms_accepted_at || terms)) {
    await saveWiseDetails(account.id, String(form.get("email") ?? ""), String(form.get("name") ?? ""), terms && !account.terms_accepted_at);
  }
  return NextResponse.redirect(new URL("/dashboard?tab=payouts", req.url), { status: 303 });
}
