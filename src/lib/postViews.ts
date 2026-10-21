// SERVER ONLY. View counts of the posts that advertise our apps, read every
// 6 hours: the input for estimating which creator brought which installs
// (migrations/0044, Alain 2026-10-21).
//
// TikTok only tells the total right now, never when the views came. So an
// Apify schedule runs the task APIFY_TASK_ID (clockworks~tiktok-scraper, the
// latest posts of every tracked profile) every 6 h. When a run succeeds, Apify
// calls POST /api/post-views/ingest. The payload is not trusted: ingestRun()
// fetches the run from Apify with our own key, checks that it belongs to our
// task and succeeded, and only then stores its items. A forged call can at most
// store one of our own runs again, which changes nothing.
//
// After every ingest both task inputs are set to the active rows of
// klar_view_accounts, so an account added there is read from the next run on.
//
// Cost (Apify, 2026-10-21): 0.0037 USD per post read plus 0.001 per run.
// Kept inside Apify's free 5 USD a month on purpose (Alain: fixed costs as low
// as possible): our own 2 profiles x the latest 4 posts every 6 h is about
// 3.70 USD a month. Nearly all views come in a post's first 24 h, which 4 posts
// cover at our posting rate. Creators post less often and many sign up without
// ever posting, so their accounts go into a second task with the date filter
// (posts of the last 30 h, +0.0013 USD per post): an account without a new post
// costs nothing. The creator task has no schedule of its own; ingesting a run of
// the own task starts it, and only when there are creators.

import "server-only";
import { checkCreatorPosts } from "./postCheck";
import { listSecrets, revealSecret } from "./vault";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const APIFY = "https://api.apify.com/v2";

/** Apify tasks, created 2026-10-21. Not secrets. `klar-post-views` reads our
    own accounts, `klar-post-views-creators` the creators' (date filter). */
export const APIFY_TASK_ID = "sDI1BJGD2vlfF4Uqf";
export const APIFY_CREATOR_TASK_ID = "gRbJcBN7WtcyPVUeo";

// text and slideshowImageLinks only matter for creators' posts (lib/postCheck).
const ITEM_FIELDS =
  "id,createTime,playCount,diggCount,commentCount,shareCount,collectCount,authorMeta,webVideoUrl,isSlideshow,text,slideshowImageLinks";

export interface PostRow {
  post_id: string;
  platform: "tiktok";
  handle: string;
  posted_at: string;
  url: string | null;
  is_slideshow: boolean | null;
}

export interface ViewRow {
  post_id: string;
  fetched_at: string;
  views: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export type IngestResult =
  | { ok: true; runId: string; fetchedAt: string; posts: number; accounts: number }
  | { ok: false; error: string; retry: boolean };

function count(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Scraper items to table rows. Items without an id or a view count (the
    scraper's error items, e.g. a profile that does not exist) are dropped. */
export function parseItems(items: unknown[], fetchedAt: string): { posts: PostRow[]; views: ViewRow[] } {
  const posts: PostRow[] = [];
  const views: ViewRow[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    const played = count(r.playCount);
    const created = count(r.createTime);
    const handle = String((r.authorMeta as Record<string, unknown> | undefined)?.name ?? "").toLowerCase();
    if (!id || played === null || created === null || !handle || seen.has(id)) continue;
    seen.add(id);
    posts.push({
      post_id: id,
      platform: "tiktok",
      handle,
      posted_at: new Date(created * 1000).toISOString(),
      url: typeof r.webVideoUrl === "string" ? r.webVideoUrl : null,
      is_slideshow: typeof r.isSlideshow === "boolean" ? r.isSlideshow : null,
    });
    views.push({
      post_id: id,
      fetched_at: fetchedAt,
      views: played,
      likes: count(r.diggCount),
      comments: count(r.commentCount),
      shares: count(r.shareCount),
      saves: count(r.collectCount),
    });
  }
  return { posts, views };
}

// Same pattern as blotato.ts: the vault is the only source of the key.
let _keyCache: { key: string; at: number } | null = null;
async function getApifyKey(): Promise<string> {
  if (_keyCache && Date.now() - _keyCache.at < 300_000) return _keyCache.key;
  let key = "";
  try {
    const entry = (await listSecrets()).find((s) => !s.revoked_at && s.provider.toLowerCase() === "apify");
    if (entry) key = (await revealSecret(entry.id)) ?? "";
  } catch {
    /* vault unreachable: ingest answers no-key and Apify retries */
  }
  _keyCache = { key, at: Date.now() };
  return key;
}

async function hubInsert(table: string, rows: object[]): Promise<string | null> {
  if (rows.length === 0) return null;
  const res = await fetch(`${HUB}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: HUB_KEY(),
      Authorization: `Bearer ${HUB_KEY()}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  return res.ok ? null : `${table} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
}

/** Sets each task's profile list to its active accounts (own or creator). */
async function syncTaskInputs(key: string): Promise<{ own: number; creators: number }> {
  const res = await fetch(`${HUB}/rest/v1/klar_view_accounts?active=eq.true&platform=eq.tiktok&select=handle,source`, {
    headers: { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}` },
    cache: "no-store",
  });
  if (!res.ok) return { own: 0, creators: 0 };
  const rows = (await res.json()) as Array<{ handle: string; source: string }>;
  const lists: Array<[string, string[]]> = [
    [APIFY_TASK_ID, rows.filter((r) => r.source === "own").map((r) => r.handle)],
    [APIFY_CREATOR_TASK_ID, rows.filter((r) => r.source === "creator").map((r) => r.handle)],
  ];
  for (const [task, profiles] of lists) {
    if (profiles.length === 0) continue; // the scraper refuses an empty list
    await fetch(`${APIFY}/actor-tasks/${task}/input`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ profiles }),
      cache: "no-store",
    });
  }
  return { own: lists[0][1].length, creators: lists[1][1].length };
}

export async function ingestRun(runId: string): Promise<IngestResult> {
  const key = await getApifyKey();
  if (!key || !HUB_KEY()) return { ok: false, error: "no-key", retry: true };
  const auth = { Authorization: `Bearer ${key}` };

  const runRes = await fetch(`${APIFY}/actor-runs/${encodeURIComponent(runId)}`, { headers: auth, cache: "no-store" });
  if (runRes.status === 404) return { ok: false, error: "unknown-run", retry: false };
  if (!runRes.ok) return { ok: false, error: `run ${runRes.status}`, retry: true };
  const run = ((await runRes.json()) as { data?: Record<string, unknown> }).data ?? {};
  if (run.actorTaskId !== APIFY_TASK_ID && run.actorTaskId !== APIFY_CREATOR_TASK_ID) {
    return { ok: false, error: "foreign-run", retry: false };
  }
  if (run.status !== "SUCCEEDED" || typeof run.finishedAt !== "string") {
    return { ok: false, error: `run-${String(run.status).toLowerCase()}`, retry: false };
  }

  const itemsRes = await fetch(
    `${APIFY}/datasets/${run.defaultDatasetId}/items?clean=true&format=json&fields=${ITEM_FIELDS}`,
    { headers: auth, cache: "no-store" },
  );
  if (!itemsRes.ok) return { ok: false, error: `items ${itemsRes.status}`, retry: true };
  const items = (await itemsRes.json()) as unknown[];
  const { posts, views } = parseItems(items, run.finishedAt);

  const err = (await hubInsert("klar_posts", posts)) ?? (await hubInsert("klar_post_views", views));
  if (err) return { ok: false, error: err, retry: true };

  // A creator's post counts only after the check (caption, images); our own always do.
  if (run.actorTaskId === APIFY_CREATOR_TASK_ID) await checkCreatorPosts(items);

  const { own, creators } = await syncTaskInputs(key);
  // Our own run is the clock: it starts the creators' run, never the other way round.
  if (run.actorTaskId === APIFY_TASK_ID && creators > 0) {
    await fetch(`${APIFY}/actor-tasks/${APIFY_CREATOR_TASK_ID}/runs`, { method: "POST", headers: auth, cache: "no-store" });
  }
  return { ok: true, runId, fetchedAt: run.finishedAt, posts: posts.length, accounts: own + creators };
}
