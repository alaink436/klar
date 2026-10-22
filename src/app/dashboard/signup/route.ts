// POST /dashboard/signup: "Connect your TikTok" in the dashboard (lib/creatorAccounts connectTiktok), only the
// username; the country comes from Vercel's IP header. { reset: true } lets go of an unverified username again
// ("Use a different account"). JSON in, { ok } or { error } out. The account itself exists since the first login.

import { exceedsContentLength } from "@/lib/apiGuards";
import { connectTiktok, disconnectTiktok, getCreatorAccount } from "@/lib/creatorAccounts";
import { getSessionUser } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user?.email) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
  if (exceedsContentLength(req, 8 * 1024)) return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  const account = await getCreatorAccount(user.id);
  if (!account) return Response.json({ ok: false, error: "no_account" }, { status: 404 });
  if (body.reset === true) return Response.json({ ok: await disconnectTiktok(account) });
  const result = await connectTiktok(account, { handle: String(body.handle ?? ""), country: req.headers.get("x-vercel-ip-country") });
  if (result.ok) return Response.json({ ok: true });
  return Response.json(result, { status: result.error === "hub" ? 502 : 422 });
}
