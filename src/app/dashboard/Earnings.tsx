// The creator's month from the estimate (ticket 05): what his counted posts
// earned so far, his views per day above Basalt's sign-ups per day, and from
// 1000 followers the offer of a link. Server component.

import { card } from "../components/home/formStyles";
import { usd, type Earning, type ModelRun } from "@/lib/creatorEarnings";
import { CAP_SHARE, COMMISSION } from "@/lib/creatorModel";
import DayBars from "./DayBars";

export default function Earnings({ run, earning, offerLink, followers }: { run: ModelRun | null; earning: Earning | null; offerLink: boolean; followers: number }) {
  const month = run ? new Date(`${run.month}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }) : null;
  const days = run?.days.map((d) => d.d) ?? [];
  const views = new Map(earning?.days.map((d) => [d.d, d.views]) ?? []);

  return (
    <section className="mt-12">
      <h2 className="text-[28px] font-medium tracking-[-0.03em]">{month ? `${month} so far` : "Your earnings"}</h2>
      <div className={`${card} mt-5 text-[15px] leading-relaxed`}>
        {!run ? (
          <p className="text-[var(--ink-2)]">The first estimate comes with tomorrow&apos;s daily run.</p>
        ) : (
          <>
            <p className="text-[clamp(36px,5vw,48px)] font-medium leading-none tracking-[-0.04em] tabular-nums">{usd(earning?.payable_cents ?? 0)}</p>
            <p className="mt-3 text-[var(--ink-2)]">
              {earning
                ? `About ${earning.est_signups.toFixed(1)} sign-ups from ${earning.views.toLocaleString("en-US")} views of your counted posts.`
                : "No counted views this month yet."}{" "}
              An estimate, updated every day.
            </p>
            <p className="mt-3 text-[13.5px] text-[var(--ink-3)]">
              How we estimate: from all Basalt posts, ours and every creator&apos;s, about {run.rate_per_1000.toFixed(2)} people sign up per
              1,000 views. You get {COMMISSION * 100} % of the revenue your share brings. All creators together get at most {CAP_SHARE * 100} %
              of what Basalt earns above its usual sign-ups
              {run.cap_factor < 1 ? `; this month that scales everyone to ${Math.round(run.cap_factor * 100)} %.` : "."}
            </p>
            {days.length > 1 && (
              <>
                <DayBars title="Your views per day" days={days} values={days.map((d) => views.get(d) ?? 0)} unit="views" />
                <DayBars
                  title="Basalt sign-ups per day"
                  days={days}
                  values={run.days.map((d) => d.signups)}
                  unit="sign-ups"
                  line={{ label: "expected without posts", values: run.days.map((d) => d.baseline) }}
                />
              </>
            )}
          </>
        )}
      </div>
      {offerLink && (
        <div className={`${card} mt-6 text-[15px] leading-relaxed`}>
          <p>
            You have {followers.toLocaleString("en-US")} followers, so TikTok lets you put a link in your bio. With your own link every
            install through it counts exactly instead of being estimated.
          </p>
          <form action="/dashboard/link" method="post" className="mt-4">
            <button type="submit" className="h-11 rounded-full bg-[var(--ink)] px-5 text-[14px] font-medium text-white transition hover:opacity-85">
              Get my link
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
