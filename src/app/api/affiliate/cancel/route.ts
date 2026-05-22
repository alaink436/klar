// POST /api/affiliate/cancel
//
// Marks the affiliate as cancelled in klar_affiliates AND in each per-app
// influencers row that lives in one of the 6 app-supabases. The request is
// session-gated (auth.uid() from the SSR cookie) so only the affiliate
// themselves can fire it. Best-effort across apps: a failure in one app's
// PATCH does not block the others, and the klar_affiliates row gets the
// cancellation flag regardless so the dashboard reflects the user's intent.
//
// Body: { reason?: string }   max 240 chars
// Returns: { ok: true, apps_marked: number, apps_failed: string[] }

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, serviceSupabase } from "@/lib/supabaseAuth";
import { getApp, type AdminApp } from "@/lib/adminApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AffiliateRow {
  user_id: string;
  email: string;
  apps: string[];
  handles: Record<string, string>;
  status: string;
}

async function patchInfluencer(app: AdminApp, handle: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${app.supabaseUrl}/rest/v1/influencers?handle=eq.${encodeURIComponent(handle)}`,
      {
        method: "PATCH",
        headers: {
          apikey: app.serviceKey,
          Authorization: `Bearer ${app.serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status: "cancelled" }),
      },
    );
    return res.ok;
  } catch (e) {
    console.warn(`[affiliate/cancel] PATCH ${app.slug} threw`, e);
    return false;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let reason: string | null = null;
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body.reason === "string") {
      reason = body.reason.trim().slice(0, 240) || null;
    }
  } catch {
    /* empty body is fine */
  }

  const svc = serviceSupabase();
  const { data: rowData, error: rowErr } = await svc
    .from("klar_affiliates")
    .select("user_id, email, apps, handles, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (rowErr || !rowData) {
    return NextResponse.json({ ok: false, error: "affiliate_not_found" }, { status: 404 });
  }
  const affiliate = rowData as AffiliateRow;
  if (affiliate.status === "cancelled") {
    // Idempotent: cancelling an already-cancelled account is not an error.
    return NextResponse.json({ ok: true, apps_marked: 0, apps_failed: [], already: true });
  }

  // Fan out to every per-app supabase the affiliate is wired into. We do not
  // touch payout rows: any matured-but-unpaid earnings still flow through
  // the usual build_payout_batch cron, the cancellation only freezes future
  // attribution.
  const failed: string[] = [];
  let marked = 0;
  await Promise.all(
    affiliate.apps.map(async (slug) => {
      const app = getApp(slug);
      const handle = affiliate.handles[slug];
      if (!app || !handle) {
        failed.push(slug);
        return;
      }
      const ok = await patchInfluencer(app, handle);
      if (ok) marked += 1;
      else failed.push(slug);
    }),
  );

  // klar_affiliates flag flips regardless of per-app PATCH outcome so the
  // dashboard shows the cancelled banner immediately and a follow-up
  // retry-job (if we add one) can re-run the per-app PATCH later.
  await svc
    .from("klar_affiliates")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, apps_marked: marked, apps_failed: failed });
}
