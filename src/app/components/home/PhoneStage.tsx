"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppleSvg, PlaySvg } from "../StoreBadges";
import useOnScreen from "./useOnScreen";

// The cinematic shot under the headline: frame, clouds and the line under the
// phone. The phone itself is PhoneStageScene (three.js, loaded after the page).
// It follows the beam pill: when the pill names an app, its phone turns in
// (Alain, 2026-11-04). A click on the phone jumps to the app's section.

const Scene = dynamic(() => import("./PhoneStageScene"), { ssr: false });

export type StageApp = { id: string; name: string; icon: string; play?: string; soon: boolean; forSale: boolean };

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

  const app = apps[active];

  return (
    <div ref={box} className="relative mt-8 pb-14 md:mt-10">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[1600px] [mask-image:linear-gradient(to_bottom,transparent,#000_16%,#000_84%,transparent)] sm:aspect-[16/9] lg:aspect-[2.3/1]">
        <picture>
          <source media="(min-width: 640px)" srcSet="/home/3d/clouds-wide.webp" />
          <img src="/home/3d/clouds-tall.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
        </picture>
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "" : "opacity-0"}`}>
          <Scene ids={apps.map((a) => a.id)} active={active} onReady={onReady} run={run} />
        </div>
        <a href={`#${app.id}`} aria-hidden="true" tabIndex={-1} className="absolute inset-x-[30%] inset-y-[12%]" />
      </div>

      {/* under the shot, so it never covers the phone */}
      <a
        key={app.id}
        href={`#${app.id}`}
        className="home-pop absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-white/60 bg-white/55 py-2 pl-2 pr-5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-white/80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={app.icon} alt="" className="size-9 rounded-[22.5%]" />
        <div className="text-left">
          <p className="text-[15px] font-semibold leading-tight tracking-[-0.02em]">{app.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium leading-none text-[var(--ink-2)] [&_svg]:size-3">
            {app.soon ? (
              "Coming soon"
            ) : (
              <>
                <AppleSvg />
                App Store
                {app.play && (
                  <>
                    <span className="text-[var(--ink-3)]">·</span>
                    <PlaySvg />
                    Google Play
                  </>
                )}
              </>
            )}
            {app.forSale && (
              <>
                <span className="text-[var(--ink-3)]">·</span>
                Open to sell
              </>
            )}
          </p>
        </div>
      </a>
    </div>
  );
}
