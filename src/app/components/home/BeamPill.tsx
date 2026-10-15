"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

// The dark glass capsule under the hero headline, after a Pinterest reference
// Alain sent on 2026-10-14 ("+ Create | Brand Intelligence"): a cursor, and out
// of the cursor a soft cone of light in which the apps take turns: icon first,
// then the name types itself.

const TYPE_MS = 75;
const ERASE_MS = 35;
const HOLD_MS = 1700;

type BeamApp = { name: string; icon: string };

function useTyped(words: string[]) {
  const [text, setText] = useState(words[0]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let word = 0;
    let len = words[0].length;
    let erasing = true;
    let timer = window.setTimeout(step, HOLD_MS);

    function step() {
      len += erasing ? -1 : 1;
      setText(words[word].slice(0, len));
      if (erasing && len === 0) {
        erasing = false;
        word = (word + 1) % words.length;
        setIndex(word);
        timer = window.setTimeout(step, 300);
      } else if (!erasing && len === words[word].length) {
        erasing = true;
        timer = window.setTimeout(step, HOLD_MS);
      } else {
        timer = window.setTimeout(step, erasing ? ERASE_MS : TYPE_MS);
      }
    }

    return () => window.clearTimeout(timer);
  }, [words]);

  return { text, index };
}

export default function BeamPill({ apps }: { apps: BeamApp[] }) {
  const words = useMemo(() => apps.map((a) => a.name), [apps]);
  const { text, index } = useTyped(words);

  // The hero phones listen and wiggle that app's logo (HeroPhones).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("klar:beam", { detail: index }));
  }, [index]);

  return (
    <div className="relative mx-auto h-14 w-[min(100%,540px)] overflow-hidden rounded-full border border-white/10 bg-[rgba(14,14,16,0.88)] text-left shadow-[0_30px_60px_-28px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:h-16">
      {/* The cone: clipped wedges, blurred by their parents so the edges go soft.
          A wide faint one and a narrow bright core, both opening from the caret. */}
      <div aria-hidden="true" className="home-beam pointer-events-none absolute inset-y-0 left-[133px] w-[400px] blur-[5px] sm:left-[145px]">
        <div className="h-full w-full [clip-path:polygon(0_36%,100%_-10%,100%_110%,0_64%)] bg-[linear-gradient(90deg,rgba(255,255,255,0.5),rgba(255,255,255,0.16)_40%,rgba(255,255,255,0.04)_80%,transparent)]" />
      </div>
      <div aria-hidden="true" className="home-beam pointer-events-none absolute inset-y-0 left-[133px] w-[260px] blur-[3px] sm:left-[145px]">
        <div className="h-full w-full [clip-path:polygon(0_45%,100%_24%,100%_76%,0_55%)] bg-[linear-gradient(90deg,rgba(255,255,255,0.7),rgba(255,255,255,0.12)_55%,transparent)]" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute left-[128px] top-1/2 h-9 w-3 -translate-y-1/2 rounded-full bg-white/70 blur-[6px] sm:left-[140px]" />

      <div className="relative flex h-full items-center pl-6 text-[19px] font-medium tracking-[-0.02em] sm:pl-7 sm:text-[21px]">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M9 2v14M2 9h14" />
        </svg>
        <span className="ml-3.5 w-[76px] text-white sm:w-[84px]">Klar</span>
        <span aria-hidden="true" className="home-caret h-7 w-[1.5px] bg-white" />
        <Image
          key={index}
          src={apps[index].icon}
          alt=""
          width={28}
          height={28}
          className="home-pop ml-3 size-6 shrink-0 rounded-[22.5%] shadow-[0_0_18px_rgba(255,255,255,0.35)] sm:size-7"
        />
        <span aria-hidden="true" className="ml-2.5 whitespace-nowrap text-[#e4e4e8]">
          {text}
        </span>
        <span className="sr-only">Apps by Klar: {words.join(", ")}</span>
      </div>
    </div>
  );
}
