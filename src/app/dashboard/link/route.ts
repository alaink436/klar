// POST /dashboard/link: a verified creator from 1000 followers switches to a
// bio link (lib/creatorAccounts switchToLink), back to the dashboard.

import { NextResponse } from "next/server";
import { LINK_FOLLOWERS, getCreatorAccount, switchToLink } from "@/lib/creatorAccounts";
import { getSessionUser } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/dashboard/login", req.url), { status: 303 });
  const account = await getCreatorAccount(user.id);
  if (account && (account.followers ?? 0) >= LINK_FOLLOWERS) await switchToLink(account);
  return NextResponse.redirect(new URL("/dashboard?tab=earnings", req.url), { status: 303 });
}
