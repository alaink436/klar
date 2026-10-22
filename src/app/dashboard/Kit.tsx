"use client";

import { useState, type ReactNode } from "react";
import { CalendarCheck, Check, ChevronLeft, Clock, Copy, Download, Eye, Music, Pin, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { RiTiktokFill } from "@remixicon/react";
import { zipSync } from "fflate";
import { card } from "../components/home/formStyles";

// The kit in the creator dashboard: his own version of every active format,
// slide by slide, with the caption to copy (ticket 03). The signed image links
// last an hour, the page renders new ones on every visit. "Make me a new one"
// hands out another version of a format, one per format every 20 hours
// (POST /dashboard/kit/new); the kit always shows the newest.
//
// Since 2026-10-22 (Alain: "eine bessere Ansicht", "einen Button, wo die Person die Slides direkt herunterladen
// kann", "unten einen Hinweis für Captions"): one row per slideshow with the cover at the left, all slides small beside it,
// "Download all slides" (on a phone the share sheet, so "Save images" puts them in the photos in order; on a
// computer a ZIP), and "What to write" under the cards.

export interface KitView {
  formatId: string;
  name: string;
  hook: string;
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
      className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--ink)] px-5 text-[14px] font-medium sm:w-auto text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85 disabled:opacity-60"
    >
      {state === "done" ? <Check className="size-[18px]" strokeWidth={2} /> : <Download className="size-[18px]" strokeWidth={1.9} />}
      {label}
    </button>
  );
}

// "What to write" as TikTok's post screen with the first slideshow filled in, the notes beside it (Alain 2026-10-22:
// "What to write als TikTok-Feld", "nicht so gevibecodet"). Dark numbers point at a field of the screen, the light
// marks are notes without one.
function Mark({ dark, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${dark ? "bg-[var(--ink)] text-[var(--paper)]" : "border border-[var(--hair)] bg-white text-[var(--ink)]"}`}
    >
      {children}
    </span>
  );
}

function PostScreen({ title, caption, cover }: { title: string; caption: string; cover?: string }) {
  return (
    <div className="rounded-[28px] border border-[var(--hair)] bg-white p-4 shadow-[0_24px_50px_-32px_rgba(0,0,0,0.45)]" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-[var(--hair)] pb-3">
        <ChevronLeft className="size-5" strokeWidth={1.8} />
        <span className="text-[14px] font-semibold">Post</span>
        <RiTiktokFill className="size-5" />
      </div>
      <div className="mt-4 flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex gap-2 text-[15px] font-semibold leading-snug">
            <Mark dark>1</Mark>
            <span className="min-w-0 pt-0.5">{title}</span>
          </p>
          <p className="mt-3 flex gap-2 text-[13px] leading-relaxed text-[var(--ink-2)]">
            <Mark dark>2</Mark>
            <span className="line-clamp-5 min-w-0 pt-0.5">{caption}</span>
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs */}
        {cover && <img src={cover} alt="" className="h-[104px] w-[78px] shrink-0 rounded-xl object-cover" />}
      </div>
      <div className="mt-4 flex gap-2 text-[12.5px] font-medium text-[var(--ink-2)]">
        <span className="rounded-full bg-[#f2f2f3] px-3 py-1.5"># Hashtags</span>
        <span className="rounded-full bg-[#f2f2f3] px-3 py-1.5">@ Mention</span>
      </div>
      <div className="mt-4 rounded-full bg-[#fe2c55] py-2.5 text-center text-[14px] font-semibold text-white">Post</div>
    </div>
  );
}

const NOTES: Array<[ReactNode, boolean, string, string]> = [
  [1, true, "Title", "The line on slide 1 is the hook. It goes into the title."],
  [2, true, "Caption", "Paste ours with “Copy caption”. The hashtags are in it, and the app’s name has to stay."],
  [<Music key="sound" className="size-3.5" strokeWidth={2} />, false, "Sound", "Pick one of TikTok’s trending sounds before you post."],
  [<Check key="words" className="size-3.5" strokeWidth={2.2} />, false, "Your own words", "Fine, as long as you don’t promise what the app doesn’t do."],
];

// "How to post" as tiles (Alain 2026-10-22: "nicht zu viel auf einmal posten", "ein einheitliches Zeitfenster", "was
// gibt es sonst noch"): the two from Alain first, then what our counting needs (posts stay up, public account) and
// what keeps the reach real.
const GUIDE: Array<[LucideIcon, string, string]> = [
  [CalendarCheck, "One or two a day", "A few hours apart. Several at once take reach from each other."],
  [Clock, "Same time every day", "When your followers are usually online."],
  [Pin, "Leave your posts up", "We read views every 6 hours. A deleted post stops counting."],
  [Eye, "Keep your account public", "We only see the views of a public account."],
  [Sparkles, "Every version once", "For your next post, make yourself a new one."],
  [ShieldCheck, "Real views only", "No bought views, likes or followers."],
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
      <div className="mt-6 grid gap-4">
        {kit.map((k) => (
          // A row per slideshow (Alain 2026-10-22: "jede Slideshow als breite Zeile"): the cover at the left, title,
          // slides and buttons beside it. min-w-0: the slide strip would otherwise widen the whole page on a phone.
          <div key={k.formatId} className={`${card} flex min-w-0 gap-4 p-4! sm:gap-6 sm:p-5!`}>
            <a href={k.slides[0]?.download} className="relative block w-[96px] shrink-0 self-start overflow-hidden rounded-xl bg-white sm:w-[150px] sm:rounded-2xl" aria-label="Save the cover">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs */}
              <img src={k.slides[0]?.view} alt="" className="aspect-[3/4] w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[12px]">
                {k.slides.length} slides
              </span>
            </a>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-medium leading-snug tracking-[-0.02em] sm:text-[17px]">
                {k.name}
                {k.version > 1 && <span className="ml-2 text-[13px] font-normal text-[var(--ink-3)]">version {k.version}</span>}
              </p>
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {k.slides.map((s, i) => (
                  <a key={s.view} href={s.download} className="group flex-none" aria-label={`Save slide ${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URLs */}
                    <img src={s.view} alt="" loading="lazy" className="h-16 w-auto rounded-lg shadow-[0_6px_16px_-10px_rgba(0,0,0,0.45)] transition group-hover:-translate-y-0.5 sm:h-20" />
                    <span className="mt-1 block text-center text-[11px] tabular-nums text-[var(--ink-3)]">{i + 1}</span>
                  </a>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DownloadAll slides={k.slides} name={k.formatId} />
                <CopyCaption text={k.caption} />
                <NewVersion formatId={k.formatId} nextInHours={k.nextInHours} />
              </div>
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
        <section className="mt-14">
          <h3 className="text-[22px] font-medium tracking-[-0.03em]">What to write</h3>
          <div className="mt-5 grid items-center gap-7 sm:grid-cols-[minmax(0,320px)_1fr] sm:gap-9">
            <PostScreen title={kit[0].hook} caption={kit[0].caption} cover={kit[0].slides[0]?.view} />
            <ul className="grid gap-5">
              {NOTES.map(([mark, dark, head, text]) => (
                <li key={head} className="flex gap-3">
                  <Mark dark={dark}>{mark}</Mark>
                  <div className="pt-0.5">
                    <p className="text-[15px] font-medium leading-snug">{head}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink-2)]">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {kit.length > 0 && (
        <section className="mt-14">
          <h3 className="text-[22px] font-medium tracking-[-0.03em]">How to post</h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDE.map(([Icon, head, text]) => (
              // A row on a phone (six tiles would be a tower), a tile from sm.
              <li key={head} className="flex items-start gap-3.5 rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:block">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[var(--ink)] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.25)]">
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 sm:mt-3">
                  <p className="text-[15.5px] font-medium leading-snug tracking-[-0.01em]">{head}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
