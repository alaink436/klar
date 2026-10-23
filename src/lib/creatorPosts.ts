// How often a creator posted since signing up, as one line for Klar Control > Bewerbungen and Creators (Alain
// 2026-10-23: "wie oft die Leute gepostet haben", "dass ich das im Klar Dashboard auch gleich sehe"). Counts only what
// the creators' Apify task stored (lib/postViews, every 6 h, confirmed creators only) and lib/postCheck checked.

import type { CheckStatus } from "./postCheck";

export interface PostRow {
  status: CheckStatus;
  postedAt: string;
}

// Our slideshow by its images, approved from the review list, or a Basalt post of a link creator.
const OURS: CheckStatus[] = ["counts", "approved", "link"];

const when = (ms: number) =>
  new Date(ms).toLocaleString("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "1 Post seit Anmeldung · 0 davon unsere Slideshows · zuletzt 22.10., 20:43" */
export function postLine(signedUpAt: string, posts: PostRow[]): string {
  const since = posts.map((p) => ({ ...p, at: Date.parse(p.postedAt) })).filter((p) => p.at >= Date.parse(signedUpAt));
  const n = since.length;
  if (n === 0) return "0 Posts seit Anmeldung";
  const ours = since.filter((p) => OURS.includes(p.status)).length;
  const review = since.filter((p) => p.status === "review").length;
  return [
    `${n} ${n === 1 ? "Post" : "Posts"} seit Anmeldung`,
    `${ours} davon unsere Slideshows`,
    ...(review > 0 ? [`${review} auf der Prüfliste`] : []),
    `zuletzt ${when(Math.max(...since.map((p) => p.at)))}`,
  ].join(" · ");
}
