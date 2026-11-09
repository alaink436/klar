// GET /api/routines/performance?app=<slug>[&days=14]: how a routine's formats and posts did, for the cloud routine to
// read before it writes new posts (TAGESROUTINE.md, step 3; Alain 2026-11-09: "damit du daraus lernst"). The same
// numbers as /admin/content, tab Formate (lib/formatBoard).
//
// Answers formats ranked by mean views in the first 24 hours, and every post with its hook, hashtags and views, the
// best first. Auth like GET /api/routines (vault:use bearer, lib/routineAuth).

import { hookOf, rankPosts, summarizeFormats, tagsOf } from "@/lib/formatBoard";
import { routineCaller } from "@/lib/routineAuth";
import { listRoutines, routinePosts } from "@/lib/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const denied = await routineCaller(req);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const app = q.get("app") ?? "";
  const days = Math.min(60, Math.max(1, Number(q.get("days")) || 14));
  if (!(await listRoutines()).some((r) => r.app_slug === app)) {
    return Response.json({ error: "app: learnbound, pocketmate, basalt or kelva" }, { status: 400 });
  }
  const posts = (await routinePosts(days)).filter((p) => p.app_slug === app);
  return Response.json({
    app,
    days,
    formats: summarizeFormats(posts).map(({ format, posts: n, read, avg24h, avg3d, best }) => ({ format, posts: n, read, avg24h, avg3d, best })),
    posts: rankPosts(posts).map((p) => ({
      name: p.name,
      handle: p.handle,
      format: p.format,
      scheduled_for: p.scheduledFor,
      hook: hookOf(p.caption),
      hashtags: tagsOf(p.caption),
      views_24h: p.views24h,
      views_3d: p.views3d,
      views_now: p.viewsNow,
      url: p.url,
    })),
  });
}
