"use client";

import { Children, useEffect, useRef, useState } from "react";

// The apps side by side instead of six long sections (Alain, 2026-10-14: "vor
// allem auf dem Handy"). Swipe or scroll sideways, every card snaps to the
// centre; arrows on desktop, dots for where you are. Links to #<app> still
// land on the right card, the browser scrolls this row as well.

export default function AppCarousel({ children }: { children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const count = Children.count(children);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let dist = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const card = c as HTMLElement;
        const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      setAt(best);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function show(i: number) {
    const el = row.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/70 text-[var(--ink)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex";

  return (
    <div className="relative">
      <div
        ref={row}
        className="home-rail flex snap-x snap-mandatory gap-4 overflow-x-auto px-[max(7vw,calc((100vw-1100px)/2))] pb-2 md:gap-6"
      >
        {children}
      </div>

      <button type="button" aria-label="Previous app" disabled={at === 0} onClick={() => show(at - 1)} className={`${arrow} left-4 lg:left-8`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M11 4 6 9l5 5" />
        </svg>
      </button>
      <button type="button" aria-label="Next app" disabled={at === count - 1} onClick={() => show(at + 1)} className={`${arrow} right-4 lg:right-8`}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="m7 4 5 5-5 5" />
        </svg>
      </button>

      <div className="mt-6 flex justify-center gap-2">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`App ${i + 1} of ${count}`}
            aria-current={at === i}
            onClick={() => show(i)}
            className={`h-2 rounded-full transition-all ${at === i ? "w-6 bg-[var(--ink)]" : "w-2 bg-[var(--ink-3)]/40 hover:bg-[var(--ink-3)]"}`}
          />
        ))}
      </div>
    </div>
  );
}
