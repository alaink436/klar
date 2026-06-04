// Klar Control entry route. Every admin view is now its own React route under
// /admin/* — overview, revenue, payouts, templates, inbox, outreach, the
// dynamic [app] affiliate detail, plus cal / bookings / analytics / brain /
// settings. This handler only guards auth and forwards legacy ?view=… URLs
// (and bare /admin) to the matching route, preserving query params (minus
// `view`) so the ?msg= flashes + filters those routes render still arrive
// after a POST-action redirect.
//
// Env: KLAR_ADMIN_KEY, KLAR_TOTP_SECRET, KLAR_DEVICE_SECRET (auth via _shared
// checkAuth), KLAR_ADMIN_APPS (app registry, see lib/adminApps).

import { getApps } from "../../lib/adminApps";
import { checkAuth } from "./_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 303 to a migrated React route, forwarding every query param except `view`.
// POST handlers (dispatch/reconcile/suspend/approve/decline/reply/…) redirect
// to ?view=<x>&msg=…; forwarding keeps the ?msg= flash + filters intact.
function redirectTo(url: URL, target: string): Response {
  const params = new URLSearchParams(url.searchParams);
  params.delete("view");
  const qs = params.toString();
  return new Response(null, {
    status: 303,
    headers: { Location: qs ? `${target}?${qs}` : target },
  });
}

export async function GET(req: Request): Promise<Response> {
  const auth = await checkAuth(req);
  if (!auth.authed) {
    // Misconfigured envs or unknown device or expired session — bounce to
    // the unified login page, which handles all three cases.
    return new Response(null, { status: 303, headers: { Location: "/admin/login" } });
  }

  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "overview";

  if (view === "outreach") return redirectTo(url, "/admin/outreach");
  if (view === "inbox") return redirectTo(url, "/admin/inbox");
  if (view === "templates") return redirectTo(url, "/admin/templates");
  // A real app slug → the dynamic /admin/[app] route; everything else
  // (incl. overview + unknown views) → the overview landing route.
  const app = getApps().find((a) => a.slug === view);
  if (app) return redirectTo(url, `/admin/${encodeURIComponent(app.slug)}`);
  return redirectTo(url, "/admin/overview");
}
