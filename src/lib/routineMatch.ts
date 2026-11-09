// Ties a routine's TikTok draft to the TikTok post Apify read later (migrations/0056).
//
// Alain posts the drafts by hand, so nothing carries the TikTok id back to us. What survives the trip: the hashtag
// line (TikTok returns only that as the post's text; the hook is the title, which the scraper does not read) and the
// time (a draft reaches the inbox at its scheduled time and is posted after it). So a routine post matches the
// earliest TikTok post of the same account, with the same set of hashtags, posted from just before its time to three
// days after. Routine posts are taken in their scheduled order, which keeps two posts with identical hashtags (common
// at Pocketmate) in posting order.

export interface RoutinePostRef {
  id: string;
  handle: string;
  caption: string | null;
  scheduledFor: string | null;
  postId: string | null;
}

export interface TikTokPostRef {
  postId: string;
  handle: string;
  caption: string | null;
  postedAt: string;
}

const EARLY = 30 * 60_000; // clocks and Blotato's queue: a draft may land a little before its slot
const LATE = 3 * 86_400_000;

/** The hashtags of a caption as one comparable key: lower case, sorted, unique. Empty when there are none. */
export function hashtagKey(text: string | null): string {
  const tags = (text ?? "").toLowerCase().match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(tags)].sort().join(" ");
}

/** New links (routine post id -> TikTok post id). Posts already linked on either side stay as they are. */
export function matchPosts(routine: RoutinePostRef[], tiktok: TikTokPostRef[]): Array<{ id: string; postId: string }> {
  const taken = new Set(routine.map((r) => r.postId).filter((p): p is string => Boolean(p)));
  const open = routine
    .filter((r) => !r.postId && r.scheduledFor && hashtagKey(r.caption))
    .sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!));
  const byHandle = new Map<string, TikTokPostRef[]>();
  for (const t of [...tiktok].sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt))) {
    const h = t.handle.toLowerCase();
    byHandle.set(h, [...(byHandle.get(h) ?? []), t]);
  }
  const out: Array<{ id: string; postId: string }> = [];
  for (const r of open) {
    const at = Date.parse(r.scheduledFor!);
    const key = hashtagKey(r.caption);
    const hit = (byHandle.get(r.handle.toLowerCase()) ?? []).find((t) => {
      const posted = Date.parse(t.postedAt);
      return !taken.has(t.postId) && posted >= at - EARLY && posted <= at + LATE && hashtagKey(t.caption) === key;
    });
    if (!hit) continue;
    taken.add(hit.postId);
    out.push({ id: r.id, postId: hit.postId });
  }
  return out;
}

/** Views of a post at a given age: the last snapshot taken by then, null when none was taken yet. */
export function viewsAt(
  snaps: Array<{ fetchedAt: string; views: number }>,
  postedAt: string,
  ageMs: number,
  now = Date.now(),
): number | null {
  const until = Date.parse(postedAt) + ageMs;
  if (until > now) return null;
  let best: number | null = null;
  let bestAt = -Infinity;
  for (const s of snaps) {
    const t = Date.parse(s.fetchedAt);
    if (t <= until && t > bestAt) {
      best = s.views;
      bestAt = t;
    }
  }
  return best;
}
