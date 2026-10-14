// Basalt - Follow Through: app home page, /basalt
//
// The app's website while it lives under getklar.org, and the page a creator
// link opens on a computer (getklar.org/basalt/<handle> -> Detour -> here with
// ?ref=). Since 2026-10-14 in the light Klar Studios frame of the front page
// (Alain: "Inspiration von der getklar.org Seite"): a large iPhone floating
// beside the headline with the stones film on its screen, new copy, and the
// store buttons. Phones get an install banner: Safari draws Apple's from the
// itunes metadata, Chrome on Android opens Play's install sheet from the bar.
//
// The film is the App Store header (Content/asc/header-styles/aether), scaled
// to 80 % so the big stone stays whole on a tall screen, haze extended above
// and below. Claims stay within the store listing.

import type { Metadata } from "next";
import Link from "next/link";
import { findKlarApp } from "@/lib/klarApps";
import { AppleSvg, PlaySvg } from "../components/StoreBadges";
import AndroidInstallBar from "../components/AndroidInstallBar";
import BlurHeadline from "../components/home/BlurHeadline";
import Film from "../components/home/Film";
import Site, { SUPPORT_EMAIL } from "../components/home/Site";

const APP = findKlarApp("wavelength")!;
const APP_STORE_ID = "6762440839";

export const metadata: Metadata = {
  title: "Basalt - Follow Through · Weekly habits in a widget",
  description:
    "Write down what you want to follow through on and how many times a week. Then tick it off on your home screen.",
  robots: { index: true, follow: true },
  itunes: { appId: APP_STORE_ID },
  manifest: "/basalt/basalt.webmanifest",
};

const FEATURES = [
  {
    title: "Ticked off in the widget",
    line: "Check in from the home screen without opening the app. Most days, that is all you do.",
  },
  {
    title: "Weekly, not daily",
    line: "Three runs a week, one call home on Sunday. A missed Tuesday is a missed Tuesday, not a reason to quit.",
  },
  {
    title: "A routine can end",
    line: "Give it a span if you want one. When the span is over, the routine is done. Finished, not abandoned.",
  },
  {
    title: "Shut what pulls at you",
    line: "Lock the apps and sites that eat your hour, on demand or every night. Basalt never learns what you picked.",
  },
];

function StoreButtons() {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={APP.appStoreUrl!}
        className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85"
      >
        <AppleSvg size={17} />
        App Store
      </a>
      {APP.playStoreUrl && (
        <a
          href={APP.playStoreUrl}
          className="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/70 bg-white/50 px-6 text-[15px] font-medium tracking-[-0.01em] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-white/80"
        >
          <PlaySvg size={17} />
          Google Play
        </a>
      )}
    </div>
  );
}

function Phone() {
  return (
    // On a computer the whole phone fits under the header: its width follows the
    // window height (482:1000 is the frame), never wider than 360 px.
    <div className="home-phone-rise mx-auto w-[min(58vw,270px)] md:w-[clamp(240px,min(26vw,calc((100svh-190px)*0.482)),360px)]">
      <div className="home-phone-bob" style={{ animationDuration: "7s" }}>
        <div className="relative aspect-[482/1000] drop-shadow-[0_40px_50px_rgba(0,0,0,0.26)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/iphone.webp" alt="" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-[4.4%] inset-y-[2.3%] overflow-hidden rounded-[11%/5.3%] bg-[#dcdcda]">
            <Film wide="/basalt/stones" label="Basalt stones turning from black to frosted glass" className="h-full w-full" />
            <div className="absolute left-1/2 top-[1.8%] h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BasaltHomePage() {
  return (
    <Site>
      <main className="relative overflow-hidden">
        <div className="home-grid absolute inset-0" aria-hidden="true" />
        <div className="home-glow absolute inset-0" aria-hidden="true" />

        <section className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-20 pt-28 sm:px-8 md:min-h-svh md:grid-cols-[1.1fr_0.9fr] md:gap-8 md:pb-16 md:pt-28">
          <div className="md:order-2">
            <Phone />
          </div>

          <div className="md:order-1">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={APP.icon} alt="" className="size-12 rounded-[12px] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)]" />
              <div>
                <p className="text-[17px] font-semibold tracking-[-0.03em]">Basalt</p>
                <p className="text-[13px] font-medium text-[var(--ink-3)]">Weekly habits · iPhone and Android</p>
              </div>
            </div>

            <BlurHeadline
              as="h1"
              lead="Your routine"
              glass="actually gets done."
              className="mt-8 text-[clamp(44px,6.4vw,92px)] font-medium leading-[0.92] tracking-[-0.05em]"
            />

            <p className="mt-7 max-w-[520px] text-[17px] leading-[1.55] text-[var(--ink-2)]">
              Write down what you want to follow through on and how many times a week. Then tick it off on your home
              screen.
            </p>

            <div className="mt-9">
              <StoreButtons />
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-[1200px] px-5 pb-20 sm:px-8 md:pb-28">
          <div className="grid gap-px overflow-hidden rounded-[28px] border bg-[var(--hair)] sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[var(--paper)]/90 p-7 backdrop-blur-sm md:p-9">
                <h2 className="text-[22px] font-medium tracking-[-0.03em]">{f.title}</h2>
                <p className="mt-2.5 max-w-[440px] text-[15px] leading-[1.55] text-[var(--ink-3)]">{f.line}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-[13px] leading-[2] text-[var(--ink-3)]">
            <Link href="/basalt/privacy" className="underline underline-offset-2 hover:text-[var(--ink)]">Privacy Policy</Link>
            {" · "}
            <Link href="/basalt/terms" className="underline underline-offset-2 hover:text-[var(--ink)]">Terms of Use</Link>
            {" · "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-[var(--ink)]">{SUPPORT_EMAIL}</a>
            <br />
            Made by Alain Kessler in Switzerland. Data stored in the European Union.
          </p>
        </section>
      </main>

      {APP.playStoreUrl && (
        <AndroidInstallBar
          id="basalt"
          name="Basalt"
          line="Weekly habits"
          icon={APP.icon}
          playUrl={APP.playStoreUrl}
        />
      )}
    </Site>
  );
}
