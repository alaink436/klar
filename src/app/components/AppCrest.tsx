"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AppleBadge, PlayBadge } from "./StoreBadges";
import codebase from "../data/codebase.json";

interface CbMetric {
  files: number;
  lines: number;
  kb: number;
  code_lines: number;
  style_lines: number;
  sql_lines: number;
  commits: number | null;
  avg_per_file: number;
  dirs: { name: string; lines: number }[];
}
const CB = (codebase as { apps: Record<string, CbMetric> }).apps;
const nfmt = (n: number) => n.toLocaleString("en-US");

function Codebase({ slug }: { slug: string }) {
  const m = CB[slug];
  if (!m) return null;
  const max = Math.max(...m.dirs.map((d) => d.lines), 1);
  const cards: [string, string][] = [
    [nfmt(m.lines), "lines"],
    [nfmt(m.files), "files"],
    [m.commits != null ? nfmt(m.commits) : "—", "commits"],
    [nfmt(m.avg_per_file), "avg / file"],
  ];
  return (
    <div className="brut-line p-4 sm:p-5 mb-6 sm:mb-8 bg-[var(--bg-2)]">
      <p className="label mb-3">codebase · scanned from the repo</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {cards.map(([v, k]) => (
          <div key={k}>
            <p className="display text-2xl sm:text-3xl">{v}</p>
            <p className="label mt-1">{k}</p>
          </div>
        ))}
      </div>
      <p className="label mb-2">where the code lives · scroll</p>
      <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
        {m.dirs.map((d) => (
          <div key={d.name} className="flex items-center gap-3">
            <span className="label-fg w-24 sm:w-32 shrink-0 truncate">
              {d.name}
            </span>
            <span className="flex-1 h-2 bg-[var(--bg)] relative">
              <span
                className="absolute inset-y-0 left-0 bg-[var(--fg)]"
                style={{ width: `${Math.round((d.lines / max) * 100)}%` }}
              />
            </span>
            <span className="label w-12 text-right shrink-0 tabular-nums">
              {nfmt(d.lines)}
            </span>
          </div>
        ))}
      </div>
      <p className="label mt-3">
        {nfmt(m.code_lines)} ts/tsx
        {m.sql_lines ? ` · ${nfmt(m.sql_lines)} sql` : ""} · solo + ai loop
      </p>
    </div>
  );
}

export type Status = "LIVE" | "BETA" | "BUILD";

export interface App {
  slug: string;
  name: string;
  pitch: string;
  description: string;
  business: { free: string; paid: string; price?: string };
  status: Status;
  buildNote: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  icon: string;
  screenshots?: string[];
}

interface Props {
  apps: App[];
}

const SPIN_MS = 44000;

export default function AppCrest({ apps }: Props) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [size, setSize] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const open = openSlug ? apps.find((a) => a.slug === openSlug) ?? null : null;

  useEffect(() => {
    if (!openSlug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenSlug(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openSlug]);

  // measure the stage so the orbit radius scales with the layout
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el);
    setSize(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // orbit via Web Animations API (bypasses the CSS bundler; ring spins,
  // each icon counter-spins so it stays upright). Reduced-motion -> static.
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring || size === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const opts = {
      duration: SPIN_MS,
      iterations: Infinity,
      easing: "linear",
    } as const;
    const a = ring.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      opts
    );
    const items = Array.from(
      ring.querySelectorAll<HTMLElement>("[data-orbit]")
    );
    const counter = items.map((el) =>
      el.animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(-360deg)" }],
        opts
      )
    );
    return () => {
      a.cancel();
      counter.forEach((c) => c.cancel());
    };
  }, [size]);

  const hovered = hover ? apps.find((a) => a.slug === hover) : null;
  const R = size * 0.3; // orbit radius
  const box = Math.max(40, size * 0.42); // icon box

  return (
    <>
      {/* Orbiting crest — 6 icons circling, tap one */}
      <div
        ref={stageRef}
        className="relative mx-auto w-[min(86vw,520px)] aspect-square"
        role="group"
        aria-label="the six apps — tap an icon"
      >
        <div ref={ringRef} className="absolute inset-0">
          {apps.map((app, i) => {
            const ang = i * (360 / apps.length);
            return (
              <div
                key={app.slug}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: box,
                  height: box,
                  transform: `translate(-50%,-50%) rotate(${ang}deg) translateY(${-R}px) rotate(${-ang}deg)`,
                }}
              >
                <button
                  type="button"
                  data-orbit
                  onClick={() => setOpenSlug(app.slug)}
                  onMouseEnter={() => setHover(app.slug)}
                  onMouseLeave={() =>
                    setHover((h) => (h === app.slug ? null : h))
                  }
                  onFocus={() => setHover(app.slug)}
                  onBlur={() => setHover((h) => (h === app.slug ? null : h))}
                  className="block w-full h-full p-0 border-0 bg-transparent cursor-pointer"
                  aria-label={`open ${app.name} details`}
                >
                  <span className="block w-full h-full icon-card relative">
                    <Image
                      src={app.icon}
                      alt={app.name}
                      fill
                      sizes="(max-width: 640px) 38vw, 220px"
                      className="object-contain"
                      priority={i < 3}
                    />
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none w-[46%]">
          <p className="display text-2xl sm:text-3xl md:text-4xl leading-none">
            {hovered ? hovered.name.toLowerCase() : "the six"}
          </p>
          <p className="label mt-2">
            {hovered ? hovered.pitch : "tap an icon"}
          </p>
        </div>
      </div>

      {/* ─────────── APP MODAL ─────────── */}
      {open && (
        <div
          className="modal-overlay flex items-center justify-center px-3 py-6 sm:py-10"
          onClick={() => setOpenSlug(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${open.name} details`}
        >
          <article className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpenSlug(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 label-fg w-9 h-9 flex items-center justify-center brut-line-thin hover:bg-[var(--fg)] hover:text-[var(--bg)] hover:border-[var(--fg)] transition z-10 bg-[var(--bg)]"
              aria-label="close"
            >
              ×
            </button>

            {/* Header strip — black brutalist accent */}
            <div className="bg-[var(--fg)] text-[var(--bg)] px-5 sm:px-7 py-2 flex items-center justify-between">
              <span className="label-fg" style={{ color: "var(--bg)" }}>
                {open.buildNote}
              </span>
              <span className="label-fg" style={{ color: "var(--bg)" }}>
                {open.status}
              </span>
            </div>

            <div className="p-5 sm:p-8">
              {/* Hero: icon + name */}
              <div className="flex items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="relative w-20 h-20 sm:w-28 sm:h-28 shrink-0">
                  <Image
                    src={open.icon}
                    alt={open.name}
                    fill
                    sizes="112px"
                    className="object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="display text-3xl sm:text-5xl mb-2">
                    {open.name.toLowerCase()}
                  </h3>
                  <p className="editorial text-lg sm:text-2xl text-[var(--fg-2)]">
                    {open.pitch}
                  </p>
                </div>
              </div>

              {/* Screenshots row (if available) */}
              {open.screenshots && open.screenshots.length > 0 && (
                <div className="mb-6 sm:mb-8">
                  <p className="label mb-3">screens</p>
                  <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                    {open.screenshots.map((src, i) => (
                      <div
                        key={i}
                        className="relative shrink-0 w-[140px] sm:w-[180px] aspect-[9/19.5] brut-line-thin snap-start bg-[var(--bg)]"
                      >
                        <Image
                          src={src}
                          alt={`${open.name} screenshot ${i + 1}`}
                          fill
                          sizes="180px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="mb-6 sm:mb-8">
                <p className="label mb-2">about</p>
                <p className="t-body-lg text-[var(--fg-2)] leading-relaxed">
                  {open.description}
                </p>
              </div>

              {/* Business model */}
              <div className="brut-line p-4 sm:p-5 mb-6 sm:mb-8 bg-[var(--bg-2)]">
                <p className="label mb-3">business model</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                  <div>
                    <p className="label-fg mb-1">free</p>
                    <p className="text-[var(--fg-2)] text-sm leading-relaxed">
                      {open.business.free}
                    </p>
                  </div>
                  <div>
                    <p className="label-fg mb-1">
                      premium{" "}
                      {open.business.price ? `· ${open.business.price}` : ""}
                    </p>
                    <p className="text-[var(--fg-2)] text-sm leading-relaxed">
                      {open.business.paid}
                    </p>
                  </div>
                </div>
              </div>

              {/* Codebase x-ray */}
              <Codebase slug={open.slug} />

              {/* Store badges */}
              <div className="flex flex-wrap gap-3">
                <AppleBadge href={open.appStoreUrl} />
                <PlayBadge href={open.playStoreUrl} />
              </div>
              {!open.appStoreUrl && !open.playStoreUrl && (
                <p className="label mt-3">stores coming soon</p>
              )}
            </div>
          </article>
        </div>
      )}
    </>
  );
}
