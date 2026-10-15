"use client";

import { useEffect, useRef, useState } from "react";

// "Post about our apps. Get paid." with the effect on the letters themselves
// (Alain, 2026-10-14: "Effekte auf den Fonts, nicht auf dem Hintergrund").
// When the heading scrolls into view its words come out of a blur one after
// another, and the last line is set in frosted-glass letters.

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
  // Blur on the outer span, glass on the inner one: both are filters and would
  // overwrite each other on a single element.
  const word = (w: string, i: number, glassy = false) => (
    <span key={i} className="home-blur-word" style={{ transitionDelay: `${i * 90}ms` }}>
      {glassy ? <span className="home-glass-text">{w}</span> : w}
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
      {glassWords.map((w, i) => (
        <span key={i}>
          {word(w, leadWords.length + i, true)}
          {i < glassWords.length - 1 ? " " : ""}
        </span>
      ))}
    </h2>
  );
}
