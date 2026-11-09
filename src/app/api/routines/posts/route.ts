// POST /api/routines/posts: a cloud routine reports the drafts it scheduled (TAGESROUTINE.md, step 5), so Klar
// Control can show how each post did once Apify has read it (lib/routines, lib/routineMatch).
//
// Body: {"posts": [{"app_slug", "handle", "name", "format"?, "caption"?, "scheduled_for"?, "blotato_id"?}]}, at most
// 50 per call. A name sent again for the same account updates its row (a resend). Auth as GET /api/routines.

import { exceedsContentLength } from "@/lib/apiGuards";
import { routineCaller } from "@/lib/routineAuth";
import { recordRoutinePosts, type RoutinePostIn } from "@/lib/routines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_POSTS = 50;

export async function POST(req: Request): Promise<Response> {
  if (exceedsContentLength(req, MAX_BODY_BYTES)) return Response.json({ ok: false, error: "too-large" }, { status: 413 });
  const denied = await routineCaller(req);
  if (denied) return denied;
  let body: { posts?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const posts = Array.isArray(body.posts) ? (body.posts as RoutinePostIn[]) : null;
  if (!posts || posts.length === 0 || posts.length > MAX_POSTS || posts.some((p) => !p || typeof p !== "object")) {
    return Response.json({ ok: false, error: `posts: 1 to ${MAX_POSTS} objects` }, { status: 400 });
  }
  const res = await recordRoutinePosts(posts);
  return Response.json(res, { status: res.ok ? 200 : 422 });
}
