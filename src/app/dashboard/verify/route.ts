// POST /dashboard/verify: checks the signed-in creator's bio for his code.
// Each check is one Evomi scrape, so it is rate-limited per user. The first
// confirmation sends him a mail.

import { after } from "next/server";
import { rateLimit } from "@/lib/apiGuards";
import { getCreatorAccount, verifyCreatorAccount } from "@/lib/creatorAccounts";
import { sendConfirmedMail } from "@/lib/creatorMail";
import { getSessionUser } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
  if (!rateLimit("creator-verify", user.id, 8, 10 * 60_000).ok) {
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const account = await getCreatorAccount(user.id);
  if (!account) return Response.json({ ok: false, error: "no_account" }, { status: 404 });
  const result = await verifyCreatorAccount(account);
  if (result.ok) {
    if (!account.verified_at && account.tiktok_handle) {
      const { email, tiktok_handle, bio_code } = account;
      after(() => sendConfirmedMail(email, tiktok_handle, bio_code));
    }
    return Response.json({ ok: true });
  }
  return Response.json(result, { status: result.error === "hub" ? 502 : 422 });
}
