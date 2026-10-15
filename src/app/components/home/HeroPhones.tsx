"use client";

import { useEffect, useState } from "react";
import { AppleSvg, PlaySvg } from "../StoreBadges";

// The hero's phones (Alain, 2026-10-14): one iPhone per app, each at its own
// depth, height and float period, rising in from the bottom. The body is the
// real model rendered straight on (public/home/iphone.webp, script in
// AI-Brain Projects/Klar/Content/web-hero/phone-frame.py). The screen is a
// still from the app's own film (public/home/scenes, cut from the store films:
// its logo, mascot or scene, Alain 2026-10-15), with a glass card on top: icon,
// name, where the app is out. When the beam pill above names an app, that
// phone's logo wiggles and glows in its own colours (Alain, 2026-10-15). A
// click jumps to the app's section. Weekly user numbers come later.

export type HeroPhoneApp = { id: string; name: string; icon: string; play?: string; soon: boolean };

// left %, top % (how far down the phone starts), depth (scale), tilt, float period in s.
// Phones show the first four only (Yarn Stash and Anime Vault come last), spread by `m`.
const POSE = [
  { left: 4, m: 1, top: 14, z: 0.86, rot: -5, period: 6.2 },
  { left: 19, m: 23, top: 6, z: 1.0, rot: 3, period: 7.4 },
  { left: 34, m: 45, top: 15, z: 0.9, rot: -2, period: 5.6 },
  { left: 50, m: 65, top: 3, z: 1.06, rot: 4, period: 6.8 },
  { left: 65, m: 0, top: 11, z: 0.94, rot: -3, period: 7.9 },
  { left: 80, m: 0, top: 8, z: 0.88, rot: 5, period: 6.0 },
];

function Screen({ app, on }: { app: HeroPhoneApp; on: boolean }) {
  return (
    <div className="absolute inset-x-[4.4%] inset-y-[2.3%] overflow-hidden rounded-[11%/5.3%] bg-black [container-type:inline-size]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/home/scenes/${app.id}.webp`} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
      <div className="absolute left-1/2 top-[1.8%] h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />

      {/* Only the top half shows above the fold, so the card sits up there. */}
      <div className="absolute inset-x-[6%] top-[13cqw] flex items-center gap-[3cqw] rounded-[6cqw] bg-black/50 p-[2.4cqw] pr-[3.6cqw] text-white backdrop-blur-md">
        <span className="relative w-[13cqw] shrink-0">
          {/* the glow is the icon itself, blown up and blurred, so it has the app's colours */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={app.icon} alt="" className={`absolute inset-0 scale-[1.7] blur-[2.6cqw] brightness-150 saturate-200 transition-opacity duration-700 ${on ? "opacity-100" : "opacity-0"}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={app.icon} alt="" className={`relative w-full rounded-[22.5%] ${on ? "home-wiggle" : ""}`} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[6cqw] font-semibold leading-tight tracking-[-0.02em]">{app.name}</p>
          <p className="mt-[0.8cqw] flex items-center gap-[1.4cqw] whitespace-nowrap text-[4cqw] font-medium leading-none text-white/75 [&_svg]:size-[4cqw]">
            {app.soon ? (
              "Coming soon"
            ) : (
              <>
                <AppleSvg />
                App Store
                {app.play && (
                  <>
                    <span className="text-white/50">·</span>
                    <PlaySvg />
                    Google Play
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function HeroPhones({ apps }: { apps: HeroPhoneApp[] }) {
  const [active, setActive] = useState(0); // the pill starts on the first app

  useEffect(() => {
    const on = (e: Event) => setActive((e as CustomEvent<number>).detail);
    window.addEventListener("klar:beam", on);
    return () => window.removeEventListener("klar:beam", on);
  }, []);

  return (
    // Clipped at the bottom only, about halfway down the phones (Alain: "nur die
    // Hälfte des Bildschirms"), like the screenshot fan before; the top stays open
    // so the tallest phone's float is not cut.
    <div className="relative mx-auto mt-14 h-[clamp(170px,17vw,250px)] max-w-[1180px] [clip-path:inset(-200%_-20%_0_-20%)] md:mt-20">
      {apps.map((app, i) => {
        const p = POSE[i % POSE.length];
        return (
          <a
            key={app.id}
            href={`#${app.id}`}
            aria-label={`${app.name}: jump to the app`}
            className={`home-phone group absolute left-[var(--lm)] w-[clamp(96px,13.5vw,196px)] sm:left-[var(--l)] ${i >= 4 ? "hidden sm:block" : ""}`}
            style={
              {
                "--l": `${p.left}%`,
                "--lm": `${p.m}%`,
                top: `${p.top}%`,
                zIndex: Math.round(p.z * 10),
                "--rot": `${p.rot}deg`,
                "--z": p.z,
              } as React.CSSProperties
            }
          >
            <div className="home-phone-rise" style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
              <div className="home-phone-bob" style={{ animationDuration: `${p.period}s`, animationDelay: `${-i * 1.3}s` }}>
                <div className="relative aspect-[482/1000] drop-shadow-[0_30px_40px_rgba(0,0,0,0.28)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/home/iphone.webp" alt="" className="absolute inset-0 h-full w-full" />
                  <Screen app={app} on={i === active} />
                </div>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
