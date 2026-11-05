"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import useOnScreen from "./useOnScreen";

// A glass headline (the hero's h1, the consults h2). The words stay real text
// for search and screen readers, but are never shown as plain type: the flat
// type flashed on every first visit before the glass version (GlassTitleScene,
// three.js, loaded after the page) had its first frame (Alain, 2026-11-05).
// The box stays empty until then and the glass fades in. `className` sizes the
// box (give it an aspect ratio).

const Scene = dynamic(() => import("./GlassTitleScene"), { ssr: false });

export default function GlassTitle({
  lines,
  as: Tag = "h1",
  left = false,
  className,
}: {
  lines: string[];
  as?: "h1" | "h2";
  left?: boolean;
  className: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const run = useOnScreen(box);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <div ref={box} className={`relative ${className}`}>
      <Tag className="sr-only">{lines.join(" ")}</Tag>
      {/* the canvas reaches past the box so tilt and bevels are not cut (left-aligned it ran flush with the column and the turned "C" was cut off, Alain 2026-11-04) */}
      <div aria-hidden="true" className={`absolute transition-opacity duration-700 ${left ? "inset-x-[-6%] inset-y-[-14%]" : "inset-[-6%]"} ${ready ? "" : "opacity-0"}`}>
        <Scene lines={lines} left={left} onReady={onReady} run={run} />
      </div>
    </div>
  );
}
