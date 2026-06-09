// SERVER ONLY. Apify-actor discovery (candidate handles only).
//
// Discovery stays on the cheap Apify actors (IG hashtag search + TT keyword
// search are captcha-walled via Evomi; per-handle enrichment is not). These
// functions return candidate handle lists only; enrichment is Evomi's job
// (evomiScraper.ts).
//
// Apify key via vault.getForProxy("658f655b-…") -> { baseUrl:"https://api.apify.com/v2",
// authHeader:"authorization", authScheme:"Bearer ", authIn:"header", key }. The actor
// endpoints are run-sync-get-dataset-items, Bearer-authed.

import "server-only";

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_TIMEOUT_MS = Number(process.env.APIFY_TIMEOUT_MS ?? 180_000); // matches n8n's 180s

/** Decrypted Apify routing (subset of vault.getForProxy()): only the key +
 *  optional base override are needed; auth is always Bearer header. */
export interface ApifyCreds {
  key: string;
  baseUrl?: string;
}

async function runActor<T>(
  actor: string,
  body: unknown,
  creds: ApifyCreds,
): Promise<{ items: T[]; runId: string | null }> {
  const base = (creds.baseUrl ?? APIFY_BASE).replace(/\/$/, "");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), APIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/acts/${actor}/run-sync-get-dataset-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.key}`,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    // Apify returns the run id in a header on run-sync endpoints.
    const runId = res.headers.get("x-apify-pagination-offset")
      ? null
      : res.headers.get("x-apify-run-id") ?? null;
    if (!res.ok) return { items: [], runId };
    const items = (await res.json()) as T[];
    return { items: Array.isArray(items) ? items : [], runId };
  } catch {
    clearTimeout(t);
    return { items: [], runId: null };
  }
}

interface IgPost {
  ownerUsername?: string;
  owner?: { username?: string };
  username?: string;
}

/** IG: apify~instagram-hashtag-scraper. hashtags -> unique ownerUsername list.
 *  Mirrors n8n "Apify IG Hashtag" body { hashtags, resultsLimit } + "IG Collect
 *  Usernames" dedupe (ownerUsername || owner.username || username). */
export async function discoverInstagramHandles(
  hashtags: string[],
  resultsLimit: number,
  creds: ApifyCreds,
): Promise<{ handles: string[]; runId: string | null }> {
  const { items, runId } = await runActor<IgPost>(
    "apify~instagram-hashtag-scraper",
    { hashtags, resultsLimit },
    creds,
  );
  const seen = new Set<string>();
  for (const post of items) {
    const u = post?.ownerUsername || post?.owner?.username || post?.username;
    if (u && typeof u === "string") seen.add(u.toLowerCase().trim());
  }
  return { handles: [...seen].filter(Boolean), runId };
}

interface TtItem {
  channel?: { username?: string; followers?: number | string };
}

/** TikTok: apidojo~tiktok-scraper. keywords -> unique channel.username list with
 *  followers (so the wave can pre-filter before spending Evomi credits). */
export async function discoverTiktokHandles(
  keywords: string[],
  maxItems: number,
  creds: ApifyCreds,
): Promise<{
  candidates: { handle: string; followers: number | null }[];
  runId: string | null;
}> {
  const { items, runId } = await runActor<TtItem>(
    "apidojo~tiktok-scraper",
    { keywords, maxItems },
    creds,
  );
  const seen = new Map<string, number | null>();
  for (const it of items) {
    const u = it?.channel?.username;
    if (!u || typeof u !== "string") continue;
    const h = u.toLowerCase().trim();
    if (seen.has(h)) continue;
    const f = it?.channel?.followers;
    seen.set(h, f == null ? null : Number(f) || null);
  }
  return {
    candidates: [...seen.entries()]
      .slice(0, maxItems)
      .map(([handle, followers]) => ({ handle, followers })),
    runId,
  };
}
