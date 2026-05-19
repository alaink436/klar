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

  return (
    <div ref={ref}>
      <div className="brut-line bg-[var(--bg-2)]">
        {/* counter + bars + control, one tight block */}
        <div className="flex items-end justify-between gap-4 px-4 sm:px-5 pt-3">
          <p className="display text-3xl sm:text-4xl tabular-nums leading-none">
            {fmt(counter)}{" "}
            <span className="label align-baseline">commits</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="label">
              {curWeek
                ? mon(curWeek.w)
                : `${mon(String(worklog.first))}→${mon(String(worklog.last))}`}
            </span>
            {!reduce && (
              <button
                type="button"
                onClick={() => done && setRunId((n) => n + 1)}
                disabled={!done}
                className="label-fg brut-line-thin px-2.5 py-1 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--fg-3)]"
              >
                {done ? "↻" : "▸"}
              </button>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-5 pt-2 pb-3">
          <div className="flex items-end gap-1 sm:gap-1.5 h-16 sm:h-20">
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
                        ? "0 0 0 1px var(--fg), 0 0 14px oklch(0.85 0 0 / 0.35)"
                        : "none",
                    }}
                  >
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
        </div>

        {/* one compact stat + legend strip */}
        <div className="border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 sm:px-5 py-2.5">
          <span className="label">
            {fmt(T.totalCommits)} commits · {T.activeDays}/{T.spanDays} days ·{" "}
            {fmt(T.brainNotes)} notes · {T.projects} projects
          </span>
          <span className="label flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5" style={{ background: "var(--fg)" }} />
              app {fmt(T.appCommits)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5" style={{ background: "var(--silver)", opacity: 0.55 }} />
              brain {fmt(T.brainCommits)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
