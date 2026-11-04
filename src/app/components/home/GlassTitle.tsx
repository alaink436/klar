"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import useOnScreen from "./useOnScreen";

// The hero headline. The words stay real text for search and screen readers and
// show as plain type until the glass version (GlassTitleScene, three.js, loaded
// after the page) has its first frame; without WebGL the plain type stays.

const Scene = dynamic(() => import("./GlassTitleScene"), { ssr: false });

export default function GlassTitle() {
  const box = useRef<HTMLDivElement>(null);
  const run = useOnScreen(box);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <div ref={box} className="relative mx-auto mt-7 aspect-[2.35/1] w-[min(96vw,1040px)]">
      <h1
        className={`absolute inset-0 flex flex-col items-center justify-center text-[clamp(64px,15.2vw,236px)] font-medium leading-[0.86] tracking-[-0.06em] transition-opacity duration-700 ${ready ? "opacity-0" : ""}`}
      >
        <span className="block">Klar</span>
        <span className="block">Studios.</span>
      </h1>
      <div aria-hidden="true" className={`absolute inset-[-6%] transition-opacity duration-700 ${ready ? "" : "opacity-0"}`}>
        <Scene onReady={onReady} run={run} />
      </div>
    </div>
  );
}
