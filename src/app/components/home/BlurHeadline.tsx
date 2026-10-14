"use client";

import { useEffect, useRef, useState } from "react";

// "Post about our apps. Get paid." with a blur reveal and a glass plate
// (Alain, 2026-10-14). When the heading scrolls into view its words come into
// focus one after another; the last line lands on frosted glass, which the
// coloured glow behind the section shows through.

export default function BlurHeadline({ lead, glass, className = "" }: { lead: string; glass: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const leadWords = lead.split(" ");
  const glassWords = glass.split(" ");
  const word = (w: string, i: number) => (
    <span key={i} className="home-blur-word" style={{ transitionDelay: `${i * 90}ms` }}>
      {w}
    </span>
  );

  return (
    <h2 ref={ref} data-in={inView ? "" : undefined} className={className}>
      {leadWords.map((w, i) => (
        <span key={i}>
          {word(w, i)}{" "}
        </span>
      ))}
      <br />
      <span
        className="home-glass-plate mt-[0.12em] inline-block rounded-[0.32em] border border-white/70 bg-white/30 px-[0.2em] pb-[0.08em] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.4)] backdrop-blur-2xl backdrop-saturate-150"
        style={{ transitionDelay: `${leadWords.length * 90}ms` }}
      >
        {glassWords.map((w, i) => (
          <span key={i}>
            {word(w, leadWords.length + i)}
            {i < glassWords.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </h2>
  );
}
