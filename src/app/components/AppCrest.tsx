"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type Status = "LIVE" | "BETA" | "BUILD";

export interface App {
  slug: string;
  name: string;
  pitch: string;
  description: string;
  business: { free: string; paid: string; price?: string };
  status: Status;
  buildNote: string;
  storeUrl?: string;
  icon: string;
}

interface Props {
  apps: App[];
}

export default function AppCrest({ apps }: Props) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const open = apps.find((a) => a.slug === openSlug) ?? null;

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenSlug(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Crest grid */}
      <div className="relative mx-auto w-full max-w-[640px] aspect-square mb-12 sm:mb-16">
        <div className="grid grid-cols-2 gap-4 sm:gap-8 md:gap-12 relative z-10">
          {apps.map((app) => (
            <button
              key={app.slug}
              onClick={() => setOpenSlug(app.slug)}
              className="icon-card group flex flex-col items-center bg-transparent border-0 p-0 cursor-pointer"
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
          ))}
        </div>

        {/* central chrome logo overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-[22%] sm:w-[24%] aspect-square">
            <Image
              src="/logo/klar-symbol.png"
              alt="Klar"
              fill
              sizes="(max-width: 640px) 22vw, 180px"
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="modal-overlay flex items-center justify-center px-4 py-8"
          onClick={() => setOpenSlug(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${open.name} details`}
        >
          <article
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* close */}
            <button
              onClick={() => setOpenSlug(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 label-fg w-8 h-8 flex items-center justify-center brut-line-thin hover:bg-[var(--fg)] hover:text-[var(--bg)] hover:border-[var(--fg)] transition z-10"
              aria-label="close"
            >
              ×
            </button>

            <div className="p-6 sm:p-10">
              {/* header */}
              <div className="flex items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="relative w-16 h-16 sm:w-24 sm:h-24 shrink-0">
                  <Image
                    src={open.icon}
                    alt={open.name}
                    fill
                    sizes="96px"
                    className="object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="label mb-2">{open.buildNote}</p>
                  <h3 className="display text-3xl sm:text-5xl mb-2">
                    {open.name.toLowerCase()}
                  </h3>
                  <p className="editorial text-lg sm:text-2xl text-[var(--fg-2)]">
                    {open.pitch}
                  </p>
                </div>
              </div>

              {/* description */}
              <div className="mb-7 sm:mb-9">
                <p className="label mb-2">about</p>
                <p className="t-body-lg text-[var(--fg-2)] leading-relaxed">
                  {open.description}
                </p>
              </div>

              {/* business model */}
              <div className="brut-line p-4 sm:p-5 mb-6 sm:mb-8">
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
                      premium {open.business.price ? `· ${open.business.price}` : ""}
                    </p>
                    <p className="text-[var(--fg-2)] text-sm leading-relaxed">
                      {open.business.paid}
                    </p>
                  </div>
                </div>
              </div>

              {/* footer / cta */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-between">
                <span
                  className="label-fg brut-line-thin px-2.5 py-1 w-fit"
                  style={
                    open.status === "LIVE"
                      ? {
                          background: "var(--fg)",
                          color: "var(--bg)",
                          borderColor: "var(--fg)",
                        }
                      : {}
                  }
                >
                  {open.status}
                </span>
                {open.storeUrl ? (
                  <Link
                    href={open.storeUrl}
                    target="_blank"
                    className="label-fg brut-line px-4 py-2.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition text-center"
                  >
                    open in app store ↗
                  </Link>
                ) : (
                  <span className="label-fg brut-line-thin px-4 py-2.5 text-center opacity-60">
                    coming soon
                  </span>
                )}
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
