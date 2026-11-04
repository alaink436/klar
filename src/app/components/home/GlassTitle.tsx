"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import useOnScreen from "./useOnScreen";

// A glass headline (the hero's h1, the consults h2). The words stay real text
// for search and screen readers and show as plain type until the glass version
// (GlassTitleScene, three.js, loaded after the page) has its first frame;
// without WebGL the plain type stays. `className` sizes the box (give it an
// aspect ratio), `textClassName` the plain type.

const Scene = dynamic(() => import("./GlassTitleScene"), { ssr: false });

export default function GlassTitle({
  lines,
  as: Tag = "h1",
  left = false,
  className,
  textClassName,
}: {
  lines: string[];
  as?: "h1" | "h2";
  left?: boolean;
  className: string;
  textClassName: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const run = useOnScreen(box);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <div ref={box} className={`relative ${className}`}>
      <Tag
        className={`absolute inset-0 flex flex-col justify-center font-medium transition-opacity duration-700 ${left ? "items-start" : "items-center"} ${textClassName} ${ready ? "opacity-0" : ""}`}
      >
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </Tag>
      {/* the canvas reaches past the box so tilt and bevels are not cut; left-aligned it keeps the column's edges */}
      <div aria-hidden="true" className={`absolute transition-opacity duration-700 ${left ? "inset-x-0 inset-y-[-14%]" : "inset-[-6%]"} ${ready ? "" : "opacity-0"}`}>
        <Scene lines={lines} left={left} onReady={onReady} run={run} />
      </div>
    </div>
  );
}
