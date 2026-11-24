import type { Metadata } from "next";
import Image from "next/image";
import { RiGithubFill } from "@remixicon/react";
import { findKlarApp } from "@/lib/klarApps";
import Site, { SUPPORT_EMAIL } from "../components/home/Site";
import GlassTitle from "../components/home/GlassTitle";

// getklar.org/consult (Alain, 2026-11-23: "Mach dann bitte lieber ein Consult-Page",
// "Das sollte auch noch etwas validität dazu geben"). Who Alain is, what he helps with,
// the apps as proof, how it starts. People land here from the Klar TikTok posts.
// User numbers as on the front page (klar_app_stats() per app, measured 2026-11-23).
// Booking since 2026-11-24: times first (/consult/book), then cal.com, then the CHF 99 RevenueCat checkout (via /consult/pay).

export const metadata: Metadata = {
  title: "Consults & Collaborations · Klar Studios",
  description:
    "Alain Kessler builds and runs six apps alone with AI agents. Consults and collaborations for shipping your app, working with Claude Code and getting your first users.",
  alternates: { canonical: "/consult" },
};

const MAIL = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Consult")}`;
const GITHUB = "https://github.com/alaink436";
// Open times first: /consult/book lists the free times of both cal.com consult events (lib/consultSlots), each links
// to cal.com's form, which forwards to /consult/pay and the CHF 99 RevenueCat checkout after booking.
const BOOK = "/consult/book";

const HELP = [
  { title: "Ship your app", text: "iPhone and Android with Expo, React Native and Supabase, from the first screen to App Store review." },
  { title: "Work with AI agents", text: "Claude Code set up with skills, memory and routines, so it builds and checks the work for you." },
  { title: "Get your first users", text: "Store page, onboarding, paywall, and TikTok slideshows that go out every day." },
  { title: "Automate the boring parts", text: "Daily content routines, scheduled posts and a dashboard that shows what works." },
];

const PROOF = [
  { slug: "wavelength", name: "Basalt", users: "900+ users" },
  { slug: "anime-vault", name: "Anime Vault", users: "240+ users" },
  { slug: "myloo", name: "Pocketmate", users: "180+ users" },
  { slug: "kelva", name: "Kelva", users: "130+ users" },
  { slug: "yarn-stash", name: "My Yarn Stash", users: "110+ users" },
];

const STEPS = [
  "Pick an open time for a call of about 60 minutes, then pay CHF 99.",
  "Tell me what you are building and where you are stuck. We work on it together.",
  "Want more after that? A fixed project or hours as you need them.",
];

const primary =
  "inline-flex h-14 items-center rounded-full bg-[var(--ink)] px-8 text-[16px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85";
const glass =
  "inline-flex h-14 items-center gap-2.5 rounded-full border border-white/70 bg-white/50 px-8 text-[16px] font-medium tracking-[-0.01em] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-white/80";
const panel =
  "rounded-[28px] border border-white/70 bg-white/45 p-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl md:p-8";

export default function Consult() {
  return (
    <Site>
      <main>
        <section className="relative overflow-hidden">
          <div className="home-grid absolute inset-0" aria-hidden="true" />
          <div className="home-glow absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1280px] px-5 pb-20 pt-32 sm:px-8 md:px-12 md:pb-28 md:pt-40">
            <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Work with me</p>
            {/* The 3D font holds only the glyphs of the titles in use ("Build it with me" came out blank), so the
                front page's words. */}
            <GlassTitle as="h1" left lines={["Consults &", "Collaborations."]} className="mt-6 aspect-[3.4/1] w-full max-w-[1100px]" />
            <p className="mt-10 max-w-[40ch] text-[clamp(18px,1.6vw,23px)] leading-[1.3] tracking-[-0.015em] text-[var(--ink-2)]">
              I&apos;m Alain. I build and run six apps on my own from Switzerland, with 1,600+ users on iPhone and
              Android. Each has its own store page, paywall and daily TikTok posts, all made with a system of AI agents
              I built myself. I can help you ship yours.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={BOOK} className={primary}>Book a call · CHF 99</a>
              <a href={MAIL} className={glass}>Write me</a>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer" className={glass}>
                <RiGithubFill size={18} aria-hidden="true" />
                GitHub
              </a>
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 md:px-12 md:py-28">
            <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">What I help with</p>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {HELP.map((h) => (
                <li key={h.title} className={panel}>
                  <h2 className="text-[clamp(24px,2.4vw,32px)] font-medium leading-tight tracking-[-0.04em]">{h.title}</h2>
                  <p className="mt-3 max-w-[42ch] text-[16px] leading-relaxed text-[var(--ink-2)]">{h.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto grid max-w-[1280px] gap-14 px-5 py-20 sm:px-8 md:grid-cols-2 md:px-12 md:py-28">
            <div>
              <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Why me</p>
              <p className="mt-6 max-w-[30ch] text-[clamp(26px,3vw,40px)] font-medium leading-[1.1] tracking-[-0.04em]">
                I don&apos;t teach what I read. I do it every day on my own apps.
              </p>
              <ul className="mt-10 space-y-4">
                {PROOF.map((p) => (
                  <li key={p.slug} className="flex items-center gap-4">
                    <Image
                      src={findKlarApp(p.slug)!.icon}
                      alt=""
                      width={44}
                      height={44}
                      className="size-11 rounded-[22.5%] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)]"
                    />
                    <span className="text-[17px] font-medium tracking-[-0.01em]">{p.name}</span>
                    <span className="ml-auto text-[15px] tabular-nums text-[var(--ink-3)]">{p.users}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">How it starts</p>
              <ol className="mt-8 space-y-6">
                {STEPS.map((step, i) => (
                  <li key={step} className="grid grid-cols-[2.5rem_1fr] items-baseline">
                    <span className="text-[13px] tabular-nums text-[var(--ink-3)]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[clamp(18px,1.6vw,22px)] leading-snug tracking-[-0.015em]">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-12 flex flex-wrap gap-3">
                <a href={BOOK} className={primary}>Book a call · CHF 99</a>
                <a href={MAIL} className={glass}>Write me</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Site>
  );
}
