"use client";

import { useState } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { zipSync } from "fflate";
import { card } from "../components/home/formStyles";

// The kit in the creator dashboard: his own version of every active format,
// slide by slide, with the caption to copy (ticket 03). The signed image links
// last an hour, the page renders new ones on every visit. "Make me a new one"
// hands out another version of a format, one per format every 20 hours
// (POST /dashboard/kit/new); the kit always shows the newest.
//
// Since 2026-10-22 (Alain: "eine bessere Ansicht", "einen Button, wo die Person die Slides direkt herunterladen
// kann", "unten einen Hinweis für Captions"): one card per slideshow with the cover large, all slides small below,
// "Download all slides" (on a phone the share sheet, so "Save images" puts them in the photos in order; on a
// computer a ZIP), and "What to write" under the cards.

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

const small =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--hair)] bg-white/70 px-4 text-[13.5px] font-medium transition hover:border-[var(--ink-3)]";

function NewVersion({ formatId, nextInHours }: { formatId: string; nextInHours: number | null }) {
  if (nextInHours) return <span className="text-[13px] text-[var(--ink-3)]">Next new one in {nextInHours} h</span>;
  return (
    <form action="/dashboard/kit/new" method="post">
      <input type="hidden" name="format" value={formatId} />
      <button type="submit" className={small}>
        <Sparkles className="size-4" strokeWidth={1.8} />
        Make me a new one
      </button>
    </form>
  );
}

function CopyCaption({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})} className={small}>
      {copied ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.8} />}
      {copied ? "Copied" : "Copy caption"}
    </button>
  );
}

// Fetches the slides and hands them over in order. A phone gets the share sheet; iOS needs share() inside the tap,
// so when the download took too long the button asks for one more tap with the files ready. A computer gets a ZIP.
function DownloadAll({ slides, name }: { slides: KitView["slides"]; name: string }) {
  const [state, setState] = useState<"idle" | "loading" | "tap" | "done" | "error">("idle");
  const [files, setFiles] = useState<File[] | null>(null);

  async function load(): Promise<File[]> {
    return Promise.all(
      slides.map(async (s, i) => {
        const res = await fetch(s.view);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        return new File([blob], `${name}-${String(i + 1).padStart(2, "0")}.jpg`, { type: blob.type || "image/jpeg" });
      }),
    );
  }

  async function share(list: File[]) {
    try {
      await navigator.share({ files: list });
      setState("done");
    } catch (e) {
      // NotAllowedError: the tap expired while loading; AbortError: the creator closed the sheet.
      setState(e instanceof Error && e.name === "NotAllowedError" ? "tap" : "idle");
    }
  }

  async function run() {
    if (state === "loading") return;
    if (state === "tap" && files) return share(files);
    setState("loading");
    try {
      const list = files ?? (await load());
      setFiles(list);
      const phone = matchMedia("(pointer: coarse)").matches;
      if (phone && navigator.canShare?.({ files: list })) return share(list);
      const entries = await Promise.all(list.map(async (f) => [f.name, new Uint8Array(await f.arrayBuffer())] as const));
      const zip = zipSync(Object.fromEntries(entries), { level: 0 });
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.zip` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const label =
    state === "loading" ? "Getting your slides" : state === "tap" ? `Tap to save ${slides.length} images` : state === "done" ? "Saved" : state === "error" ? "Didn't work, try again" : `Download all ${slides.length} slides`;
  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "loading"}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-[15px] font-medium text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85 disabled:opacity-60"
    >
      {state === "done" ? <Check className="size-[18px]" strokeWidth={2} /> : <Download className="size-[18px]" strokeWidth={1.9} />}
      {label}
    </button>
  );
}

const TIPS = [
  ["Paste our caption.", "“Copy caption” has the hashtags, and “Basalt” has to stay in it."],
  ["Use slide 1 as the title.", "The line on the first slide is the hook, put it in TikTok’s title field."],
  ["Add a sound.", "Pick one from TikTok’s trending sounds before you post."],
  ["Keep it honest.", "Write in your own words if you like, but don’t promise what the app doesn’t do."],
];

// "How to post" (Alain 2026-10-22: "nicht zu viel auf einmal posten", "ein einheitliches Zeitfenster", "was gibt es
// sonst noch"): the two from Alain first, then what our counting needs (posts stay up, public account) and what keeps
// the reach real.
const GUIDE = [
  ["One or two a day.", "Space them a few hours apart. Several at once compete with each other, and each gets less reach."],
  ["Same time every day.", "Pick an hour when your followers are usually online and post around then."],
  ["Leave your posts up.", "We read your views every 6 hours. A deleted post stops counting."],
  ["Keep your account public.", "We can only see the views of a public account."],
  ["Every version once.", "Don’t post the same one twice. For your next post, make yourself a new one."],
  ["Real views only.", "No bought views, likes or followers. We pay for reach from real people."],
];

export default function Kit({ kit, waiting, notice }: { kit: KitView[]; waiting: string[]; notice?: string }) {
  return (
    <section id="kit" className="mt-12 scroll-mt-24">
      <h2 className="text-[28px] font-medium tracking-[-0.03em]">Ready to post</h2>
      <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-[var(--ink-2)]">
        Every version is yours alone. Post the slides as a TikTok photo slideshow, unchanged and in this order: no
        cropping, no screenshots, or we can&apos;t recognise them. Posted one? Make yourself a new one.
      </p>
      {notice && NOTICE[notice] && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-[14px] ${notice === "ok" ? "bg-[#e3f1e6] text-[#1f5130]" : "bg-white/70 text-[var(--ink-2)]"}`}>{NOTICE[notice]}</p>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {kit.map((k) => (
          // min-w-0: a grid item grows to its content, and the slide row would widen the whole page on a phone.
          <div key={k.formatId} className={`${card} min-w-0 p-4! sm:p-5!`}>
            <a href={k.slides[0]?.download} className="relative block overflow-hidden rounded-2xl bg-white" aria-label="Save the cover">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs */}
              <img src={k.slides[0]?.view} alt="" className="aspect-[3/4] w-full object-cover" />
              <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">
                {k.slides.length} slides
              </span>
            </a>
            <p className="mt-4 text-[17px] font-medium leading-snug tracking-[-0.02em]">
              {k.name}
              {k.version > 1 && <span className="ml-2 text-[13px] font-normal text-[var(--ink-3)]">version {k.version}</span>}
            </p>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {k.slides.map((s, i) => (
                <a key={s.view} href={s.download} className="group flex-none" aria-label={`Save slide ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs */}
                  <img src={s.view} alt="" loading="lazy" className="h-20 w-auto rounded-lg shadow-[0_6px_16px_-10px_rgba(0,0,0,0.45)] transition group-hover:-translate-y-0.5" />
                  <span className="mt-1 block text-center text-[11px] tabular-nums text-[var(--ink-3)]">{i + 1}</span>
                </a>
              ))}
            </div>
            <div className="mt-4">
              <DownloadAll slides={k.slides} name={k.formatId} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <CopyCaption text={k.caption} />
              <NewVersion formatId={k.formatId} nextInHours={k.nextInHours} />
            </div>
          </div>
        ))}
      </div>
      {waiting.length > 0 && (
        <p className="mt-5 text-[14px] text-[var(--ink-3)]">Being prepared for you: {waiting.join(", ")}. Check back later today.</p>
      )}
      {kit.length === 0 && waiting.length === 0 && (
        <p className="mt-5 text-[14px] text-[var(--ink-3)]">No slideshows yet. They show up here as soon as we switch the first ones on.</p>
      )}
      {kit.length > 0 && (
        <div className={`${card} mt-8`}>
          <p className="text-[19px] font-medium tracking-[-0.02em]">What to write</p>
          <ul className="mt-4 grid gap-3 text-[14.5px] leading-relaxed">
            {TIPS.map(([head, text]) => (
              <li key={head}>
                <span className="font-medium">{head}</span> <span className="text-[var(--ink-2)]">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl bg-white/70 p-4 text-[14px] leading-relaxed">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--ink-3)]">Example</p>
            <p className="mt-2">
              <span className="text-[var(--ink-3)]">Title:</span> {kit[0].name}
            </p>
            <p className="mt-1">
              <span className="text-[var(--ink-3)]">Caption:</span> {kit[0].caption}
            </p>
          </div>
        </div>
      )}
      {kit.length > 0 && (
        <div className={`${card} mt-5`}>
          <p className="text-[19px] font-medium tracking-[-0.02em]">How to post</p>
          <ol className="mt-4 grid gap-x-8 gap-y-4 text-[14.5px] leading-relaxed sm:grid-cols-2">
            {GUIDE.map(([head, text], i) => (
              <li key={head} className="grid grid-cols-[2rem_1fr]">
                <span className="pt-0.5 text-[13px] tabular-nums text-[var(--ink-3)]">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="font-medium">{head}</span> <span className="text-[var(--ink-2)]">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
