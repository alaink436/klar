// How the routines' formats and posts did, as one picture for Alain (/admin/content, tab Formate) and for the cloud
// routines (GET /api/routines/performance), so a routine can see before it writes a post which hooks and topics ran
// (Alain 2026-11-09: "das ist primär auch für dich zum nachschauen ... damit du daraus lernst").
//
// Pure: takes the posts lib/routines.routinePosts() returns. A format is compared by the mean views of its posts in
// their first 24 hours; posts nobody has counted at 24 hours yet are listed but not averaged.

export interface BoardPost {
  app_slug: string;
  handle: string;
  name: string;
  format: string | null;
  caption: string | null;
  scheduledFor: string | null;
  url: string | null;
  views24h: number | null;
  views3d: number | null;
  viewsNow: number | null;
  planned: boolean;
}

export interface FormatSummary {
  app_slug: string;
  format: string;
  posts: number;
  /** posts with a count at 24 hours */
  read: number;
  avg24h: number | null;
  avg3d: number | null;
  best: { name: string; views24h: number } | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** The hook of a caption: everything but the hashtags. */
export function hookOf(caption: string | null): string {
  return (caption ?? "").replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
}

/** The hashtags of a caption, in their order. */
export function tagsOf(caption: string | null): string[] {
  return (caption ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

/** One row per app and format, the best average first; formats without a count yet at the end. */
export function summarizeFormats(posts: BoardPost[]): FormatSummary[] {
  const groups = new Map<string, BoardPost[]>();
  for (const p of posts) {
    const key = `${p.app_slug}\u0000${p.format ?? "-"}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()]
    .map(([key, ps]) => {
      const [app_slug, format] = key.split("\u0000");
      const read = ps.filter((p) => p.views24h !== null);
      const top = [...read].sort((a, b) => b.views24h! - a.views24h!)[0];
      return {
        app_slug,
        format,
        posts: ps.length,
        read: read.length,
        avg24h: mean(read.map((p) => p.views24h!)),
        avg3d: mean(ps.filter((p) => p.views3d !== null).map((p) => p.views3d!)),
        best: top ? { name: top.name, views24h: top.views24h! } : null,
      };
    })
    .sort((a, b) => (b.avg24h ?? -1) - (a.avg24h ?? -1) || a.format.localeCompare(b.format));
}

/** Posts with the most views at 24 hours first; uncounted ones after them, newest first. */
export function rankPosts(posts: BoardPost[]): BoardPost[] {
  return [...posts].sort((a, b) => {
    if (a.views24h !== null && b.views24h !== null) return b.views24h - a.views24h;
    if (a.views24h !== null) return -1;
    if (b.views24h !== null) return 1;
    return Date.parse(b.scheduledFor ?? "") - Date.parse(a.scheduledFor ?? "");
  });
}
