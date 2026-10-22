"use client";

import { useState } from "react";
import { card } from "../components/home/formStyles";

// The kit in the creator dashboard: his own version of every active format,
// slide by slide, with the caption to copy (ticket 03). The signed image links
// last an hour, the page renders new ones on every visit. "Make me a new one"
// hands out another version of a format, one per format every 20 hours
// (POST /dashboard/kit/new); the kit always shows the newest.

export interface KitView {
  formatId: string;
  name: string;
  caption: string;
  slides: Array<{ view: string; download: string }>;
  version: number;
  nextInHours: number | null;
}

const NOTICE: Record<string, string> = {
  ok: "Done: a new version is at the top of its slideshow below.",
  wait: "One new version per slideshow a day. The next one unlocks in the hours shown.",
  empty: "We're rendering more of that one right now. Try again later today.",
  no_format: "That slideshow isn't available any more.",
  hub: "Something went wrong. Try again in a moment.",
};

function NewVersion({ formatId, nextInHours }: { formatId: string; nextInHours: number | null }) {
  if (nextInHours) return <span className="text-[13px] text-[var(--ink-3)]">Next new one in {nextInHours} h</span>;
  return (
    <form action="/dashboard/kit/new" method="post">
      <input type="hidden" name="format" value={formatId} />
      <button type="submit" className="h-9 rounded-full bg-[var(--ink)] px-4 text-[13px] font-medium text-white transition hover:opacity-85">
        Make me a new one
      </button>
    </form>
  );
}

function CopyCaption({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
      className="h-9 rounded-full border border-[var(--hair)] bg-white/70 px-4 text-[13px] font-medium transition hover:border-[var(--ink-3)]"
    >
      {copied ? "Copied" : "Copy caption"}
    </button>
  );
}

export default function Kit({ kit, waiting, notice }: { kit: KitView[]; waiting: string[]; notice?: string }) {
  return (
    <section id="kit" className="mt-12 scroll-mt-24">
      <h2 className="text-[28px] font-medium tracking-[-0.03em]">Ready to post</h2>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
        These versions are yours alone. Save the images and post them as a TikTok photo slideshow, unchanged and in this
        order: no cropping, no screenshots, or we can&apos;t recognise them. Keep &ldquo;Basalt&rdquo; in the caption.
        Posted one? Make yourself a new one, every version is only yours.
      </p>
      {notice && NOTICE[notice] && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-[14px] ${notice === "ok" ? "bg-[#e3f1e6] text-[#1f5130]" : "bg-white/70 text-[var(--ink-2)]"}`}>{NOTICE[notice]}</p>
      )}
      <div className="mt-6 grid gap-5">
        {kit.map((k) => (
          // min-w-0: a grid item grows to its content, and the slide row would widen the whole page on a phone.
          <div key={k.formatId} className={`${card} min-w-0`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[19px] font-medium tracking-[-0.02em]">
                {k.name}
                {k.version > 1 && <span className="ml-2 text-[13px] font-normal text-[var(--ink-3)]">version {k.version}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <CopyCaption text={k.caption} />
                <NewVersion formatId={k.formatId} nextInHours={k.nextInHours} />
              </div>
            </div>
            <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">{k.caption}</p>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {k.slides.map((s, i) => (
                <a key={s.view} href={s.download} className="group flex-none" aria-label={`Save slide ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs */}
                  <img src={s.view} alt="" loading="lazy" className="h-48 w-auto rounded-xl shadow-[0_10px_24px_-14px_rgba(0,0,0,0.4)] transition group-hover:-translate-y-0.5" />
                  <span className="mt-1.5 block text-center text-[12px] tabular-nums text-[var(--ink-3)]">{i + 1} · save</span>
                </a>
              ))}
            </div>
          </div>
        ))}
        {waiting.length > 0 && (
          <p className="text-[14px] text-[var(--ink-3)]">Being prepared for you: {waiting.join(", ")}. Check back later today.</p>
        )}
        {kit.length === 0 && waiting.length === 0 && (
          <p className="text-[14px] text-[var(--ink-3)]">No slideshows yet. They show up here as soon as we switch the first ones on.</p>
        )}
      </div>
    </section>
  );
}
