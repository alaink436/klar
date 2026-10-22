// From LINK_FOLLOWERS followers TikTok allows a link in the bio, and with our link every install counts exactly
// instead of being estimated. Above the tabs, so a confirmed creator sees it on every tab at once (Alain 2026-10-22:
// "so, dass man das direkt sieht", "viel besser für die Person, wenn es gute Attribution gibt"); until 2026-10-22 it
// sat at the bottom of Earnings. Server component, the form posts to /dashboard/link.

import { Link2 } from "lucide-react";
import { card } from "../components/home/formStyles";

export default function LinkOffer({ followers }: { followers: number }) {
  return (
    <div className={`${card} mt-8 flex flex-col gap-4 sm:flex-row sm:items-center`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)]">
        <Link2 className="size-5" strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-medium leading-snug tracking-[-0.02em]">Get your own link</p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--ink-2)]">
          You have {followers.toLocaleString("en-US")} followers, so you can put a link in your bio. Every install through
          it counts exactly, instead of being estimated from your views.
        </p>
      </div>
      <form action="/dashboard/link" method="post" className="shrink-0">
        <button type="submit" className="h-11 w-full rounded-full bg-[var(--ink)] px-5 text-[14px] font-medium text-[var(--paper)] transition hover:opacity-85 sm:w-auto">
          Get my link
        </button>
      </form>
    </div>
  );
}
