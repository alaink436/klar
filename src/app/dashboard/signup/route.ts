// POST /dashboard/signup: creates the signed-in user's creator account
// (lib/creatorAccounts). JSON in, { ok } or { error } out. A new account goes
// into the notification digest like a website application.

import { after } from "next/server";
import { getAdminSettings, logNotifEvent } from "@/lib/adminSettings";
import { exceedsContentLength } from "@/lib/apiGuards";
import { createCreatorAccount } from "@/lib/creatorAccounts";
import { flushNotifsIfBatchReady } from "@/lib/notifFlusher";
import { getSessionUser } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user?.email) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
  if (exceedsContentLength(req, 8 * 1024)) return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  const result = await createCreatorAccount({
    userId: user.id,
    email: user.email,
    handle: String(body.handle ?? ""),
    country: String(body.country ?? ""),
    platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : [],
    hasLink: body.hasLink === true,
    acceptedEstimate: body.acceptedEstimate === true,
  });
  if (!result.ok) return Response.json(result, { status: result.error === "hub" ? 502 : 422 });

  const { account } = result;
  // after(): the function stays alive until the digest is out (see /api/inquiry).
  after(async () => {
    if (!(await getAdminSettings({ revalidate: 30 })).notification_trigger_inquiry) return;
    await logNotifEvent({
      event_type: "creator_signup",
      app_slug: account.app_slug,
      handle: account.tiktok_handle,
      payload: { email: account.email, country: account.country, has_link: account.has_link },
    });
    await flushNotifsIfBatchReady();
  });
  return Response.json({ ok: true });
}
