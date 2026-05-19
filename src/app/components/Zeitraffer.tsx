"use client";

/**
 * Zeitraffer — a time-lapse of the studio's build tempo. On scroll-in it
 * "plays": week bars grow left -> right while the headline commit counter
 * ticks up. Data is real git history across the 6 app repos + the AI-Brain
 * vault (src/app/data/worklog.json). Reduced-motion -> final frame, no play.
 *
 * Playback is a single requestAnimationFrame loop driven by elapsed time:
 * deterministic, re-render-proof, and self-correcting if frames drop.
 */
import { useEffect, useRef, useState } from "react";
import worklog from "../data/worklog.json";

interface Week {
  w: string;
  apps: number;
  brain: number;
  total: number;
  cum: number;
}

const WEEKS = worklog.weeks as Week[];
const LEN = WEEKS.length;
const T = worklog.totals;
const MAX = Math.max(...WEEKS.map((x) => x.total));
const WEEK_MS = 280; // per-week pacing
const DURATION = LEN * WEEK_MS;

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const mon = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default function Zeitraffer() {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  const [runId, setRunId] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [progress, setProgress] = useState(0); // 0 .. 1

  // reduced-motion (client-only, dependency-free)
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setReduce(m.matches);
    u();
    m.addEventListener("change", u);
    return () => m.removeEventListener("change", u);
  }, []);

  // start once the section reaches the viewport (IO + scroll/resize + mount
  // rect fallback — works even where IntersectionObserver is flaky)
  useEffect(() => {
    const el = ref.current;
    if (!el || play) return;
    let fired = false;
    const inViewport = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.9 && r.bottom > 0;
    };
    const fire = () => {
      if (fired || !inViewport()) return;
      fired = true;
      setPlay(true);
      cleanup();
    };
    const io = new IntersectionObserver(
      (e) => e.some((x) => x.isIntersecting) && fire(),
      { rootMargin: "0px 0px -10% 0px", threshold: 0 }
    );
    // Guaranteed fallback: poll the rect until in view. IO can be unreliable
    // and scroll events only fire on the actual scroll container (this site
    // scrolls <body>, not window). Polling getBoundingClientRect works in
    // every browser regardless of scroll root. Still only plays when truly
    // visible, so it never autoplays off-screen.
    const poll = window.setInterval(fire, 250);
    const cleanup = () => {
      io.disconnect();
      window.clearInterval(poll);
      document.removeEventListener("scroll", fire, true);
      window.removeEventListener("resize", fire);
    };
    io.observe(el);
    document.addEventListener("scroll", fire, { passive: true, capture: true });
    window.addEventListener("resize", fire, { passive: true });
    fire();
    return cleanup;
  }, [play]);

  // playback: time-based interval (not rAF — rAF is paused while the tab
  // is hidden, which would stall playback). Progress is recomputed from
  // elapsed time every tick, so it never drifts or stalls.
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const start = performance.now();
    const id = window.setInterval(() => {
      const p = Math.min((performance.now() - start) / DURATION, 1);
      setProgress(p);
      if (p >= 1) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [play, reduce, runId]);

  // derive frame state from progress
  const f = progress * LEN;
  const idx = Math.min(Math.floor(f), LEN); // weeks fully built
  const frac = f - Math.floor(f);
  const done = progress >= 1;

  const counter = done
    ? T.totalCommits
    : Math.round(
        (idx > 0 ? WEEKS[idx - 1].cum : 0) +
          ((idx < LEN ? WEEKS[idx].cum : WEEKS[LEN - 1].cum) -
            (idx > 0 ? WEEKS[idx - 1].cum : 0)) *
            frac
      );

  const curWeek =
    progress > 0 && !done ? WEEKS[Math.min(idx, LEN - 1)] : null;

  const tiles: [string, string, string][] = [
    [fmt(T.totalCommits), "commits", "build / ship / loop"],
    [`${T.activeDays}/${T.spanDays}`, "days shipped", "since first commit"],
    [fmt(T.brainNotes), "brain notes", "the obsidian vault"],
    [String(T.projects), "projects", "tracked end to end"],
  ];

  return (
    <div ref={ref}>
      {/* headline counter + playhead date */}
      <div className="brut-line bg-[var(--bg-2)] mb-6 sm:mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 sm:px-6 py-5 sm:py-7">
          <div>
            <p className="label mb-1">commits to date</p>
            <p className="display text-5xl sm:text-7xl md:text-8xl tabular-nums leading-none">
              {fmt(counter)}
            </p>
          </div>
          <div className="text-right">
            <p className="label mb-1">
              {curWeek
                ? `week of ${mon(curWeek.w)}`
                : `${mon(String(worklog.first))} → ${mon(String(worklog.last))}`}
            </p>
            <p className="editorial text-lg sm:text-2xl text-[var(--fg-2)]">
              {done ? "two months, solo." : "playing back…"}
            </p>
          </div>
        </div>

        {/* the time-lapse bars */}
        <div className="border-t border-[var(--line)] px-4 sm:px-6 pt-6 pb-4">
          <div className="flex items-end gap-1.5 sm:gap-2 h-40 sm:h-52">
            {WEEKS.map((wk, i) => {
              const full = (wk.total / MAX) * 100;
              const hPct =
                done || i < idx ? full : i === idx ? full * frac : 0;
              const brainH = wk.total ? (wk.brain / wk.total) * 100 : 0;
              const active = i === idx && !done && progress > 0;
              return (
                <div
                  key={wk.w}
                  className="flex-1 h-full flex flex-col justify-end"
                  title={`${mon(wk.w)} · ${wk.total} commits (${wk.apps} app / ${wk.brain} brain)`}
                >
                  <div
                    className="relative w-full"
                    style={{
                      height: `${hPct}%`,
                      transition: "height 90ms linear",
                      background: "var(--fg)",
                      boxShadow: active
                        ? "0 0 0 1px var(--fg), 0 0 18px oklch(0.85 0 0 / 0.35)"
                        : "none",
                    }}
                  >
                    {/* ai-brain portion (lighter, stacked on top) */}
                    <div
                      className="absolute top-0 left-0 w-full"
                      style={{
                        height: `${brainH}%`,
                        background: "var(--silver)",
                        opacity: 0.55,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-3">
            <span className="label">{mon(String(worklog.first))}</span>
            <span className="label">
              peak week · {fmt(T.peakWeek.total)} commits
            </span>
            <span className="label">now</span>
          </div>
        </div>

        {/* legend + replay */}
        <div className="border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-5">
            <span className="label-fg flex items-center gap-2">
              <span
                className="inline-block w-3 h-3"
                style={{ background: "var(--fg)" }}
              />
              app code · {fmt(T.appCommits)}
            </span>
            <span className="label flex items-center gap-2">
              <span
                className="inline-block w-3 h-3"
                style={{ background: "var(--silver)", opacity: 0.55 }}
              />
              ai-brain · {fmt(T.brainCommits)}
            </span>
          </div>
          {!reduce && (
            <button
              type="button"
              onClick={() => done && setRunId((n) => n + 1)}
              disabled={!done}
              className="label-fg brut-line-thin px-3 py-1.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--fg-3)]"
            >
              {done ? "↻ replay" : "playing…"}
            </button>
          )}
        </div>
      </div>

      {/* hard numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-[var(--line-strong)]">
        {tiles.map(([v, k, s]) => (
          <div
            key={k}
            className="border-b border-r border-[var(--line-strong)] p-4 sm:p-5"
          >
            <p className="display text-3xl sm:text-4xl md:text-5xl tabular-nums">
              {v}
            </p>
            <p className="label-fg mt-2">{k}</p>
            <p className="label mt-1">{s}</p>
          </div>
        ))}
      </div>

      <p className="t-body-lg text-[var(--fg-3)] mt-6 max-w-2xl">
        Every bar is a real week of git history across the six app repos and
        the brain that runs them. Not a streak graph for show, the actual
        tempo of shipping solo.
      </p>
    </div>
  );
}
