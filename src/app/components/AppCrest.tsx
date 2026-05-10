"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AppleBadge,
  PlayBadge,
  CompactAppleBadge,
  CompactPlayBadge,
} from "./StoreBadges";

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

type ModalKey = string | "family";

export default function AppCrest({ apps }: Props) {
  const [openKey, setOpenKey] = useState<ModalKey | null>(null);
  const open = openKey && openKey !== "family"
    ? apps.find((a) => a.slug === openKey) ?? null
    : null;
  const isFamilyOpen = openKey === "family";

  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openKey]);

  return (
    <>
      {/* 2x2 Crest grid (no central logo anymore) */}
      <div className="relative mx-auto w-full max-w-[640px] mb-6 sm:mb-10">
        <div className="grid grid-cols-2 gap-4 sm:gap-8 md:gap-12">
          {apps.map((app) => (
            <div key={app.slug} className="flex flex-col items-center">
              <button
                onClick={() => setOpenKey(app.slug)}
                className="icon-card group flex flex-col items-center bg-transparent border-0 p-0 cursor-pointer w-full"
                aria-label={`open ${app.name} details`}
              >
                <div className="relative w-full aspect-square">
                  <Image
                    src={app.icon}
                    alt={app.name}
                    fill
                    sizes="(max-width: 640px) 40vw, 280px"
                    className="object-contain"
                    priority
                  />
                </div>
                <span className="display text-base sm:text-xl md:text-2xl mt-2 sm:mt-3">
                  {app.name.toLowerCase()}
                </span>
              </button>
              {/* Stores directly under each icon */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 sm:mt-3">
                <CompactAppleBadge href={app.appStoreUrl} />
                <CompactPlayBadge href={app.playStoreUrl} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Family tile — 5th window under the crest */}
      <div className="mx-auto w-full max-w-[640px]">
        <button
          onClick={() => setOpenKey("family")}
          className="brut-line w-full px-5 sm:px-6 py-5 sm:py-7 flex items-center gap-4 sm:gap-5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition group bg-[var(--bg)]/40 backdrop-blur-sm cursor-pointer text-left"
          aria-label="meet the family"
        >
          {/* mini family preview */}
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0">
            <Image
              src="/family.png"
              alt="The four mascots"
              fill
              sizes="80px"
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="label mb-1 group-hover:text-[var(--bg)] group-hover:opacity-80">
              + bonus tile
            </p>
            <p className="display text-xl sm:text-2xl md:text-3xl">
              meet the family
            </p>
          </div>
          <span className="display text-2xl sm:text-3xl shrink-0">→</span>
        </button>
      </div>

      {/* ─────────── APP MODAL ─────────── */}
      {open && (
        <div
          className="modal-overlay flex items-center justify-center px-3 py-6 sm:py-10"
          onClick={() => setOpenKey(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${open.name} details`}
        >
          <article
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenKey(null)}
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

              {/* Store badges */}
              <div className="flex flex-wrap gap-3">
                <AppleBadge href={open.appStoreUrl} />
                <PlayBadge href={open.playStoreUrl} />
              </div>
              {!open.appStoreUrl && !open.playStoreUrl && (
                <p className="label mt-3">— stores soon —</p>
              )}
            </div>
          </article>
        </div>
      )}

      {/* ─────────── FAMILY MODAL ─────────── */}
      {isFamilyOpen && (
        <div
          className="modal-overlay flex items-center justify-center px-3 py-6 sm:py-10"
          onClick={() => setOpenKey(null)}
          role="dialog"
          aria-modal="true"
          aria-label="The family"
        >
          <article
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenKey(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 label-fg w-9 h-9 flex items-center justify-center brut-line-thin hover:bg-[var(--fg)] hover:text-[var(--bg)] hover:border-[var(--fg)] transition z-10 bg-[var(--bg)]"
              aria-label="close"
            >
              ×
            </button>

            <div className="bg-[var(--fg)] text-[var(--bg)] px-5 sm:px-7 py-2 flex items-center justify-between">
              <span className="label-fg" style={{ color: "var(--bg)" }}>
                + bonus
              </span>
              <span className="label-fg" style={{ color: "var(--bg)" }}>
                the family
              </span>
            </div>

            <div className="p-5 sm:p-8">
              {/* Family photo */}
              <div className="relative w-full aspect-[2/1] mb-6 sm:mb-8">
                <Image
                  src="/family.png"
                  alt="The four Klar mascots"
                  fill
                  sizes="(max-width: 640px) 90vw, 720px"
                  className="object-contain"
                  priority
                />
              </div>

              <h3 className="display text-3xl sm:text-5xl mb-2">
                the four.
              </h3>
              <p className="editorial text-lg sm:text-2xl text-[var(--fg-2)] mb-6">
                left to right: trubel, myloo, wavelength, yarn-stash.
              </p>

              <p className="t-body-lg text-[var(--fg-2)] leading-relaxed mb-6">
                Four characters, four apps. They don&apos;t share a universe —
                each one is its own little thing — but they all live under
                klar. Each one solves something specific for someone specific.
                None of them want to be your operating system.
              </p>

              {/* Quick row of all 4 */}
              <div className="grid grid-cols-4 gap-3 sm:gap-5">
                {apps.map((app) => (
                  <button
                    key={app.slug}
                    onClick={() => setOpenKey(app.slug)}
                    className="flex flex-col items-center gap-2 bg-transparent border-0 p-0 cursor-pointer icon-card"
                  >
                    <div className="relative w-full aspect-square">
                      <Image
                        src={app.icon}
                        alt={app.name}
                        fill
                        sizes="120px"
                        className="object-contain"
                      />
                    </div>
                    <span className="label-fg">
                      {app.name.toLowerCase()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
