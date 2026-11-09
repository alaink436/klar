// SERVER ONLY. Views of our own TikTok posts, read through Evomi instead of Apify (Alain 2026-11-09: "ja dann nim
// evomi. Dort haben wir noch genug Credits drauf"). Apify's free 5 USD were at 4.40 USD on 2026-11-09 with only the
// Basalt accounts; Evomi had 249,136 prepaid scraper credits, and one profile read costs 6 of them (measured).
//
// The Evomi realtime scraper renders the public profile. Its post grid carries, per post: the link (the id, and the
// id's upper 32 bits are the posting time), the view count as TikTok writes it ("1095", "12.1K") and the cover's alt
// text, which starts with the caption, i.e. our hashtag line. No likes or shares. Enough to tie a routine's draft to
// its post (lib/routineMatch) and to compare posts.
//
// Read four times a day by Vercel cron (Hobby allows each cron once a day, so four entries, /api/cron/own-views/1..4).
// The accounts are the routines' own (klar_routines.accounts). Each run then does what Apify's own run did as the
// clock: match the drafts, confirm bio codes, and start the creators' Apify task (lib/postViews.runCreatorClock).

import "server-only";
import type { PostRow, ViewRow } from "./postViews";
import { getForProxy } from "./vault";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const EVOMI_ID = "ef44b8c6-20f4-476a-8a18-2d8cd5f9b409"; // scraper key, the same entry lib/contentWarmup uses
const READ_TIMEOUT_MS = 50_000; // a render took 10 to 31 s on 2026-11-09; the function has 60 s

/** "1095" -> 1095, "12.1K" -> 12100, "1.2M" -> 1200000; null when it is no count. */
export function parseCount(s: string): number | null {
  const m = /^([\d.,]+)\s*([KMB]?)$/i.exec(s.trim());
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const mult = { "": 1, K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase() as "" | "K" | "M" | "B"];
  return Math.round(n * mult);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** The posts in a rendered profile's grid. Posts of another account (reposts) are left out. */
export function parseProfileGrid(html: string, handle: string, fetchedAt: string): { posts: PostRow[]; views: ViewRow[] } {
  const posts: PostRow[] = [];
  const views: ViewRow[] = [];
  const seen = new Set<string>();
  const own = handle.toLowerCase();
  for (const block of html.split('data-e2e="user-post-item"').slice(1)) {
    const link = /https:\/\/www\.tiktok\.com\/@([\w.]+)\/(photo|video)\/(\d{15,20})/.exec(block);
    const count = /data-e2e="video-views"[^>]*>([^<]+)</.exec(block);
    if (!link || !count || link[1].toLowerCase() !== own || seen.has(link[3])) continue;
    const played = parseCount(count[1]);
    if (played === null) continue;
    const id = link[3];
    seen.add(id);
    const alt = /alt="([^"]*)"/.exec(block)?.[1];
    // The alt text is "<caption> created by <name> with <sound>"; the caption is all we keep.
    const caption = alt ? decodeEntities(alt).split(/ created by /)[0].trim().slice(0, 2200) : null;
    posts.push({
      post_id: id,
      platform: "tiktok",
      handle: own,
      posted_at: new Date(Number(BigInt(id) >> BigInt(32)) * 1000).toISOString(),
      url: link[0],
      is_slideshow: link[2] === "photo",
      caption,
    });
    views.push({ post_id: id, fetched_at: fetchedAt, views: played, likes: null, comments: null, shares: null, saves: null });
  }
  return { posts, views };
}

async function hubPost(table: string, rows: object[], resolution: string): Promise<boolean> {
  if (rows.length === 0) return true;
  const res = await fetch(`${HUB}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: HUB_KEY(),
      Authorization: `Bearer ${HUB_KEY()}`,
      "Content-Type": "application/json",
      Prefer: `resolution=${resolution},return=minimal`,
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  return res.ok;
}

async function readProfile(handle: string, routing: NonNullable<Awaited<ReturnType<typeof getForProxy>>>): Promise<string | null> {
  const u = new URL(routing.baseUrl.replace(/\/$/, "") + "/realtime");
  if (routing.authIn === "query") u.searchParams.set(routing.authHeader, routing.key);
  u.searchParams.set("url", `https://www.tiktok.com/@${handle}`);
  u.searchParams.set("mode", "auto");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), READ_TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      headers: routing.authIn === "header" ? { [routing.authHeader]: `${routing.authScheme}${routing.key}` } : {},
      signal: ac.signal,
      cache: "no-store",
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface OwnViewsResult {
  /** handle -> posts read, or null when the profile could not be read (blocked, not found, timeout) */
  accounts: Record<string, number | null>;
  stored: boolean;
}

/** Reads every given account once, in parallel, and stores posts and view counts. */
export async function readOwnViews(handles: string[]): Promise<OwnViewsResult> {
  const routing = await getForProxy(EVOMI_ID);
  const accounts: Record<string, number | null> = {};
  if (!routing || !HUB_KEY()) return { accounts, stored: false };
  const fetchedAt = new Date().toISOString();
  const reads = await Promise.all(handles.map(async (h) => [h, await readProfile(h, routing)] as const));
  const posts: PostRow[] = [];
  const views: ViewRow[] = [];
  for (const [h, html] of reads) {
    const grid = html ? parseProfileGrid(html, h, fetchedAt) : null;
    accounts[h] = grid && grid.posts.length ? grid.posts.length : null;
    if (grid) {
      posts.push(...grid.posts);
      views.push(...grid.views);
    }
  }
  // Posts merge (caption and url may arrive later), view rows are one per post and read.
  const stored = (await hubPost("klar_posts", posts, "merge-duplicates")) && (await hubPost("klar_post_views", views, "ignore-duplicates"));
  return { accounts, stored };
}
