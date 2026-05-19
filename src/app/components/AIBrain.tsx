/**
 * AI-Brain — presents the Obsidian vault that actually runs the studio.
 * Numbers come from the same real scan as the Zeitraffer (worklog.json).
 * The vault repo is private on purpose, so this section shows the system
 * and the receipts, not a dead link (same stance as the code section).
 */
import worklog from "../data/worklog.json";
import BrainGraph from "./BrainGraph";

const T = worklog.totals;
const fmt = (n: number) => n.toLocaleString("en-US");

const STRUCTURE: [string, string][] = [
  ["Projects/", "a living PRD + PROGRESS log for every app"],
  ["Learnings/", "every root-cause, written down once, by topic"],
  ["STATUS.md", "one dashboard: active · paused · shipped"],
  ["Agents/", "the rules every ai session boots from"],
  ["Skills/", "on-demand playbooks, loaded only when needed"],
  ["Daily-Logs/", "what happened, when, and why"],
];

const STATS: [string, string][] = [
  [fmt(T.brainNotes), "markdown notes"],
  [fmt(T.brainCommits), "vault commits"],
  [String(T.projects), "projects tracked"],
  [`${T.activeDays}/${T.spanDays}`, "days touched"],
];

export default function AIBrain() {
  return (
    <div>
      <div className="grid grid-cols-12 gap-4 sm:gap-8 mb-8 sm:mb-10">
        <div className="col-span-12 md:col-span-7 max-w-2xl">
          <p className="editorial t-editorial-lg text-[var(--fg-2)]">
            every app here is run out of{" "}
            <span className="text-[var(--fg)]">one obsidian vault</span>,
            versioned in git.
          </p>
          <p className="t-body-lg text-[var(--fg-2)] mt-4">
            Each project gets a living spec and a progress log. Every problem
            I solve once goes into a shared learnings base so it never costs
            me twice. A single status file says what&apos;s active, paused or
            shipped. Every ai session reads it on the way in and writes it
            back on the way out. That is what &quot;ai in every loop&quot;
            actually means here, not a buzzword, a filesystem.
          </p>
        </div>
        <div className="col-span-12 md:col-span-5 flex md:justify-end md:items-start">
          <span className="crash-block">private vault · public results</span>
        </div>
      </div>

      {/* the actual obsidian graph */}
      <div className="mb-8 sm:mb-10">
        <p className="label mb-3">the graph · live from the vault</p>
        <BrainGraph />
      </div>

      {/* the receipts */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-[var(--line-strong)] mb-8 sm:mb-10">
        {STATS.map(([v, k]) => (
          <div
            key={k}
            className="border-b border-r border-[var(--line-strong)] p-4 sm:p-5"
          >
            <p className="display text-3xl sm:text-4xl md:text-5xl tabular-nums">
              {v}
            </p>
            <p className="label-fg mt-2">{k}</p>
          </div>
        ))}
      </div>

      {/* structure */}
      <p className="label mb-3">what&apos;s in it</p>
      <div className="border-t border-[var(--line-strong)]">
        {STRUCTURE.map(([name, desc]) => (
          <div
            key={name}
            className="border-b border-[var(--line)] py-3 sm:py-4 grid grid-cols-12 gap-2 sm:gap-4 items-baseline"
          >
            <span className="col-span-5 sm:col-span-3 label-fg">{name}</span>
            <span className="col-span-7 sm:col-span-9 t-body-lg text-[var(--fg-2)]">
              {desc}
            </span>
          </div>
        ))}
      </div>

      <p className="t-body-lg text-[var(--fg-3)] mt-6 max-w-2xl">
        It is not a notes app I keep meaning to tidy. It is the operating
        system the studio runs on, and the reason one person can hold six
        apps in their head at once.
      </p>
    </div>
  );
}
