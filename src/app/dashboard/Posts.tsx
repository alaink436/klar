// The creator's posts with what became of them (ticket 04) and, without a link,
// the estimate per counted post (ticket 05). Server component: labels only, no
// actions.

import { usd } from "@/lib/creatorEarnings";
import type { CreatorPost } from "@/lib/postCheck";
import { card } from "../components/home/formStyles";

const LABEL: Record<CreatorPost["status"], string> = {
  counts: "Counts",
  link: "Counts through your link",
  approved: "Counts (reviewed)",
  review: "In review",
  no_mention: "Doesn't count: no “Basalt” in the caption",
  not_ours: "Doesn't count: own content counts only with a link",
  suspended: "Doesn't count: posted during your pause",
  rejected: "Rejected",
};
const REJECTED: Record<string, string> = {
  own_content: "Rejected: own content without a link",
  false_claims: "Rejected: promises about Basalt that aren't true",
};
const COUNTS = new Set(["counts", "link", "approved"]);

export default function Posts({
  posts,
  estimates,
}: {
  posts: CreatorPost[];
  estimates?: Map<string, { signups: number; commissionCents: number }>;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-[28px] font-medium tracking-[-0.03em]">Your posts</h2>
      {posts.length === 0 ? (
        <p className="mt-2 text-[15px] text-[var(--ink-2)]">Nothing yet. Posts show up here a few hours after you publish them.</p>
      ) : (
        <ul className={`${card} mt-5 divide-y divide-[var(--hair)] !py-2`}>
          {posts.map((p) => (
            <li key={p.postId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-[14.5px]">
              <span>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium underline decoration-[var(--hair)] underline-offset-4">
                    {new Date(p.postedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </a>
                ) : (
                  new Date(p.postedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                )}
                <span className="ml-3 tabular-nums text-[var(--ink-3)]">{p.views.toLocaleString("en-US")} views</span>
              </span>
              <span className={COUNTS.has(p.status) ? "text-[var(--ink)]" : "text-[var(--ink-3)]"}>
                {p.status === "rejected" && p.reason ? REJECTED[p.reason] : LABEL[p.status]}
                {estimates?.has(p.postId) && (
                  <span className="ml-2 tabular-nums text-[var(--ink-3)]">
                    ≈ {estimates.get(p.postId)!.signups.toFixed(1)} sign-ups, {usd(estimates.get(p.postId)!.commissionCents)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
