"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import useOnScreen from "./useOnScreen";

// The cinematic shot under the headline: frame, clouds and the app's store
// screenshots under the phone. The phone itself is PhoneStageScene (three.js,
// loaded after the page). It follows the beam pill: when the pill names an app,
// its phone turns in and its screenshots come with it (Alain, 2026-11-04). A
// click on the phone or a screenshot jumps to the app's section.

const Scene = dynamic(() => import("./PhoneStageScene"), { ssr: false });

export type StageApp = { id: string; name: string; icon: string; play?: string; soon: boolean; forSale: boolean; shots: string[] };

export default function PhoneStage({ apps }: { apps: StageApp[] }) {
  const box = useRef<HTMLDivElement>(null);
  const run = useOnScreen(box);
  const [active, setActive] = useState(0); // the pill starts on the first app
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const on = (e: Event) => setActive((e as CustomEvent<number>).detail);
    window.addEventListener("klar:beam", on);
    return () => window.removeEventListener("klar:beam", on);
  }, []);

  // the next app's screenshots, so they are there when its phone turns in
  useEffect(() => {
    apps[(active + 1) % apps.length].shots.forEach((src) => (new Image().src = src));
  }, [active, apps]);

  const app = apps[active];

  return (
    <div ref={box} className="relative mt-8 md:mt-10">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[1600px] [mask-image:linear-gradient(to_bottom,transparent,#000_16%,#000_84%,transparent)] sm:aspect-[16/9] lg:aspect-[2.3/1]">
        <picture>
          <source media="(min-width: 640px)" srcSet="/home/3d/clouds-wide.webp" />
          <img src="/home/3d/clouds-tall.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        </picture>
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "" : "opacity-0"}`}>
          <Scene apps={apps} active={active} onReady={onReady} run={run} />
        </div>
        <a href={`#${app.id}`} aria-hidden="true" tabIndex={-1} className="absolute inset-x-[30%] inset-y-[12%]" />
      </div>

      {/* each screenshot its own tile ("darunter unterteilt", Alain 2026-11-04);
          name and stores are on the phone's screen */}
      <a
        key={app.id}
        href={`#${app.id}`}
        aria-label={`${app.name}: jump to the app`}
        className="mx-auto flex max-w-[1100px] justify-center gap-2 px-5 pb-12 sm:gap-3 md:pb-16"
      >
        {app.shots.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            width={660}
            height={1434}
            className={`home-pop h-auto min-w-0 max-w-[130px] flex-1 rounded-[14px] shadow-[0_18px_40px_-22px_rgba(0,0,0,0.4)] ${i >= 3 ? "hidden sm:block" : ""}`}
            // they come as the new phone turns in, not while the old one is still in front
            style={{ animationDelay: `${450 + i * 60}ms` }}
          />
        ))}
      </a>
    </div>
  );
}
