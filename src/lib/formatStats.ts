// SERVER ONLY. Views per post for each format, from the creators' counted posts,
// and the "tired" mark (spec Projects/Klar/specs/creator-plattform, ticket 05).
//
// A post is compared by its views three days after posting (the last snapshot
// before then), so young posts don't drag a format down. Tired: the posts of its
// last 7 days average under half of its first 7 days, with at least 3 posts in
// each. Only a mark for Alain, nothing switches off by itself.
//
// Our own posts are not tied to a format in the database, so they come as one
// figure: views after three days of the posts of the last week.

import "server-only";
import { CREATOR_APP } from "./creatorAccounts";

const HUB = process.env.KLAR_INBOX_SUPABASE_URL ?? "https://exiuwektrqxvycclqfdd.supabase.co";
const HUB_KEY = () => process.env.KLAR_INBOX_SERVICE_KEY ?? "";
const DAY = 86_400_000;
const AGE = 3 * DAY;
const MIN_POSTS = 3;

export interface FormatStat {
  formatId: string;
  posts: number;
  viewsPerPost: number | null;
  tired: boolean;
}

export interface FormatStats {
  formats: FormatStat[];
  own: { posts: number; viewsPerPost: number | null };
}

async function hubGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${HUB}/rest/v1/${path}`, { headers: { apikey: HUB_KEY(), Authorization: `Bearer ${HUB_KEY()}` }, cache: "no-store" });
  return res.ok ? ((await res.json()) as T[]) : [];
}

const inList = (values: string[]) => `in.(${values.map((v) => `"${v.replace(/"/g, "")}"`).join(",")})`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Is the format tired? `posts` are (posted at, views after three days). */
export function isTired(posts: Array<{ at: number; views: number }>): boolean {
  if (posts.length < 2 * MIN_POSTS) return false;
  const firstAt = Math.min(...posts.map((p) => p.at));
  const lastAt = Math.max(...posts.map((p) => p.at));
  if (lastAt - firstAt < 14 * DAY) return false;
  const early = posts.filter((p) => p.at < firstAt + 7 * DAY).map((p) => p.views);
  const late = posts.filter((p) => p.at > lastAt - 7 * DAY).map((p) => p.views);
  if (early.length < MIN_POSTS || late.length < MIN_POSTS) return false;
  return mean(late)! < mean(early)! / 2;
}

/** Views of each post three days after posting; posts younger than that are left out. */
async function viewsAfterThreeDays(posts: Array<{ post_id: string; posted_at: string }>, now: number): Promise<Map<string, number>> {
  const aged = posts.filter((p) => Date.parse(p.posted_at) + AGE <= now);
  const out = new Map<string, number>();
  if (aged.length === 0) return out;
  const postedAt = new Map(aged.map((p) => [p.post_id, Date.parse(p.posted_at)]));
  const snaps = await hubGet<{ post_id: string; fetched_at: string; views: number }>(
    `klar_post_views?post_id=${inList(aged.map((p) => p.post_id))}&select=post_id,fetched_at,views&order=fetched_at.asc`,
  );
  for (const s of snaps) {
    if (Date.parse(s.fetched_at) <= postedAt.get(s.post_id)! + AGE) out.set(s.post_id, Number(s.views));
  }
  return out;
}

export async function formatStats(now = Date.now()): Promise<FormatStats> {
  const [formats, checks, accounts] = await Promise.all([
    hubGet<{ id: string }>(`klar_formats?app_slug=eq.${CREATOR_APP}&select=id&order=active.desc,created_at,id`),
    hubGet<{ post_id: string; variant_id: string }>("klar_post_checks?variant_id=not.is.null&status=in.(counts,approved)&select=post_id,variant_id"),
    hubGet<{ handle: string }>(`klar_view_accounts?app_slug=eq.${CREATOR_APP}&source=eq.own&select=handle`),
  ]);
  const [variants, creatorPosts, ownPosts] = await Promise.all([
    checks.length ? hubGet<{ id: string; format_id: string }>(`klar_format_variants?id=${inList(checks.map((c) => c.variant_id))}&select=id,format_id`) : [],
    checks.length ? hubGet<{ post_id: string; posted_at: string }>(`klar_posts?post_id=${inList(checks.map((c) => c.post_id))}&select=post_id,posted_at`) : [],
    accounts.length
      ? hubGet<{ post_id: string; posted_at: string }>(
          `klar_posts?handle=${inList(accounts.map((a) => a.handle))}&posted_at=gte.${new Date(now - 10 * DAY).toISOString()}&select=post_id,posted_at`,
        )
      : [],
  ]);
  const [creatorViews, ownViews] = await Promise.all([viewsAfterThreeDays(creatorPosts, now), viewsAfterThreeDays(ownPosts, now)]);

  const formatOf = new Map(variants.map((v) => [v.id, v.format_id]));
  const postedAt = new Map(creatorPosts.map((p) => [p.post_id, Date.parse(p.posted_at)]));
  const byFormat = new Map<string, Array<{ at: number; views: number }>>();
  for (const c of checks) {
    const views = creatorViews.get(c.post_id);
    const format = formatOf.get(c.variant_id);
    if (views === undefined || !format) continue;
    byFormat.set(format, [...(byFormat.get(format) ?? []), { at: postedAt.get(c.post_id)!, views }]);
  }
  return {
    formats: formats.map((f) => {
      const posts = byFormat.get(f.id) ?? [];
      return { formatId: f.id, posts: posts.length, viewsPerPost: mean(posts.map((p) => p.views)), tired: isTired(posts) };
    }),
    own: { posts: ownViews.size, viewsPerPost: mean([...ownViews.values()]) },
  };
}
