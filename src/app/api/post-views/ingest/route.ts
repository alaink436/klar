// POST /api/post-views/ingest: Apify calls this when a run of the task
// `klar-post-views` succeeded (webhook on ACTOR.RUN.SUCCEEDED). Only the run id
// is read from the body; lib/postViews checks the run against Apify itself, so
// the route needs no shared secret.
//
// Status codes steer Apify's retries: 5xx (no key, Apify or hub hiccup) is
// retried, 4xx (not our run, run not finished) is not.

import { exceedsContentLength } from "@/lib/apiGuards";
import { ingestRun } from "@/lib/postViews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A creators' run checks images (lib/postCheck, OpenCV); give it the Hobby maximum.
export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;
const RUN_ID_RE = /^[A-Za-z0-9]{10,32}$/;

export async function POST(req: Request): Promise<Response> {
  if (exceedsContentLength(req, MAX_BODY_BYTES)) return Response.json({ ok: false, error: "too-large" }, { status: 413 });
  let body: { eventData?: { actorRunId?: unknown }; resource?: { id?: unknown } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const runId = body.eventData?.actorRunId ?? body.resource?.id;
  if (typeof runId !== "string" || !RUN_ID_RE.test(runId)) {
    return Response.json({ ok: false, error: "no-run-id" }, { status: 400 });
  }
  const result = await ingestRun(runId);
  if (result.ok) return Response.json(result);
  return Response.json(result, { status: result.retry ? 502 : 422 });
}
