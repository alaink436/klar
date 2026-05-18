import Link from "next/link";
import Image from "next/image";
import AppCrest, { type App } from "./components/AppCrest";
import GlitchWordmark from "./components/GlitchWordmark";
import NowFeed from "./components/NowFeed";
import CodebaseView from "./components/CodebaseView";
import { AffiliateForm, ConsultingForm, CoachingForm } from "./components/Forms";
import codebase from "./data/codebase.json";

const CB_TOTALS = codebase.totals;
const nf = (n: number) => n.toLocaleString("en-US");

const APPS: App[] = [
  {
    slug: "trubel",
    name: "Trubel",
    pitch: "drop a pin. fill it with photos.",
    description:
      "Geo-tagged photo albums with a time window, shared via QR code. Guests shoot with their normal camera during the event. At the host-set trigger time the app scans their camera roll for matching photos and proposes them for upload. Zero friction during the party. All albums land as pins on a world map.",
    business: {
      free: "3 active albums, 100 photos per album, basic world map",
      paid: "Unlimited albums, 4K downloads, auto-reel highlights, public map visibility",
      price: "tbd",
    },
    status: "BUILD",
    buildNote: "build · IAP done",
    icon: "/icons/trubel.png",
    screenshots: [
      "/screenshots/trubel/01.jpg",
      "/screenshots/trubel/02.jpg",
      "/screenshots/trubel/03.jpg",
    ],
  },
  {
    slug: "myloo",
    name: "MyLoo",
    pitch: "tracking. without the gross.",
    description:
      "Take a photo, Vision AI classifies it on the Bristol Stool Scale. For people with IBS, Crohn's, colitis and parents who track for doctor's visits. No friction, no judgement. Photos stay local on the device by default; cloud sync is opt-in only.",
    business: {
      free: "5 photo scans / day, 30-day history, manual entries unlimited",
      paid: "Unlimited scans + history, PDF export for doctors, food-diary correlations, trigger detection",
      price: "tbd",
    },
    status: "BETA",
    buildNote: "in review",
    icon: "/icons/myloo.png",
    screenshots: [
      "/screenshots/myloo/01.jpg",
      "/screenshots/myloo/02.jpg",
      "/screenshots/myloo/03.jpg",
      "/screenshots/myloo/04.jpg",
      "/screenshots/myloo/05.jpg",
    ],
  },
  {
    slug: "wavelength",
    name: "Wavelength",
    pitch: "plan smarter, together.",
    description:
      "Personal calendar plus voting tool for friend groups and sport teams. Heatmap availability voting, vision-OCR for paper schedules, sport-specific lineups for 8 sports. The group plan that doesn't annoy.",
    business: {
      free: "2 groups, 5 events per group, manual block creation",
      paid: "Unlimited groups + events, vision-OCR import, calendar auto-sync, boost",
      price: "tbd",
    },
    status: "BUILD",
    buildNote: "native build",
    icon: "/icons/wavelength.png",
  },
  {
    slug: "yarn-stash",
    name: "Yarn-Stash",
    pitch: "stash. match. knit.",
    description:
      "Yarn inventory, pattern matching via Ravelry and project tracking for knitters and crocheters. Scan the wrapper, Vision AI extracts everything automatically. Does the work Ravelry forgot.",
    business: {
      free: "20 yarns, 3 active projects, pattern search, manual entry, wrapper scan",
      paid: "Unlimited stash, yarn-photo scan, sharing with friends, PDF/CSV export",
      price: "tbd",
    },
    status: "LIVE",
    buildNote: "live · 4★+",
    appStoreUrl: "https://apps.apple.com/app/yarn-stash",
    icon: "/icons/yarnstash.png",
    screenshots: [
      "/screenshots/yarn-stash/01.jpg",
      "/screenshots/yarn-stash/02.jpg",
      "/screenshots/yarn-stash/03.jpg",
      "/screenshots/yarn-stash/04.jpg",
    ],
  },
  {
    slug: "kelva",
    name: "Kelva",
    pitch: "your life, one calm hub.",
    description:
      "An all-in-one personal hub: tasks, notes, habits and routines in one calm place instead of ten apps fighting for your attention. Built for people who want structure without the productivity-cult overhead.",
    business: {
      free: "Core hub, daily planner, habits, limited history",
      paid: "Unlimited everything, cross-device sync, advanced routines, exports",
      price: "tbd",
    },
    status: "BUILD",
    buildNote: "in review",
    icon: "/icons/kelva.png",
  },
  {
    slug: "moto",
    name: "Moto",
    pitch: "every service, logged.",
    description:
      "Maintenance and service tracking for motorcycles: oil, chain, tyres and mileage-based reminders, full service history and a shop log. Know exactly when the bike needs what, and prove it when you sell.",
    business: {
      free: "1 bike, core service log, basic reminders",
      paid: "Unlimited bikes, smart mileage reminders, full history export, shop sharing",
      price: "tbd",
    },
    status: "BUILD",
    buildNote: "in review",
    icon: "/icons/moto.png",
  },
];

const GITHUB_PROFILE = "https://github.com/alaink436";
const GITHUB_NOW = "https://github.com/alaink436/now";

export default function Home() {
  return (
    <>
      {/* ─── GLOBAL LIQUID-METAL BACKGROUND (4-layer cross-fade) ─── */}
      <div className="bg-stage" aria-hidden="true">
        <div
          className="bg-layer bg-layer-1"
          style={{ backgroundImage: "url('/bg/bg-1.webp')" }}
        />
        <div
          className="bg-layer bg-layer-2"
          style={{ backgroundImage: "url('/bg/bg-2.webp')" }}
        />
        <div
          className="bg-layer bg-layer-3"
          style={{ backgroundImage: "url('/bg/bg-3.webp')" }}
        />
        <div
          className="bg-layer bg-layer-4"
          style={{ backgroundImage: "url('/bg/bg-4.webp')" }}
        />
        <div className="bg-vignette" />
      </div>

      <main className="min-h-screen relative">
        {/* ─────────── NAV ─────────── */}
        <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-5 border-b border-[var(--line)] relative z-20 veil-dark">
          <div className="flex items-baseline gap-2 sm:gap-3">
            <span className="display text-xl sm:text-2xl">klar</span>
            <span className="label hidden sm:inline">v0.8 · ch</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5 md:gap-8">
            <Link href="#apps" className="label hover:text-[var(--fg)] transition">
              apps
            </Link>
            <Link href="/log" className="label hover:text-[var(--fg)] transition">
              log
            </Link>
            <Link
              href="#code"
              className="label hidden md:inline hover:text-[var(--fg)] transition"
            >
              code
            </Link>
            <Link
              href="#affiliate"
              className="label hidden md:inline hover:text-[var(--fg)] transition"
            >
              affiliate
            </Link>
            <Link
              href="#consulting"
              className="label hidden md:inline hover:text-[var(--fg)] transition"
            >
              consulting
            </Link>
            <Link
              href="#coaching"
              className="label hidden md:inline hover:text-[var(--fg)] transition"
            >
              coaching
            </Link>
            <Link
              href={GITHUB_PROFILE}
              target="_blank"
              className="label hidden md:inline hover:text-[var(--fg)] transition"
            >
              github ↗
            </Link>
            <Link
              href="https://www.tiktok.com/@klar"
              target="_blank"
              className="label-fg flex items-center gap-1.5 group"
            >
              <span className="text-[var(--silver)] group-hover:text-[var(--fg)] transition">
                ●
              </span>
              @klar
            </Link>
          </div>
        </nav>

        {/* ─────────── HERO ─────────── */}
        <section className="veil-light px-4 sm:px-6 md:px-12 pt-12 sm:pt-20 md:pt-32 pb-16 sm:pb-24 md:pb-36 relative z-10 border-b border-[var(--line)]">
          <div className="flex items-baseline justify-between mb-6 sm:mb-10">
            <p className="label">001 // klar studio</p>
            <p className="label">{nf(CB_TOTALS.lines)} lines · solo</p>
          </div>

          <GlitchWordmark
            text="klar"
            className="t-wordmark text-[var(--fg)] -ml-1 sm:-ml-2"
          />

          <div className="mt-8 sm:mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-12 gap-7 sm:gap-8 md:items-end">
            <div className="md:col-span-7 max-w-2xl">
              <p className="editorial t-editorial-xl">
                we build apps for the
                <br />
                people who never{" "}
                <span className="text-[var(--silver)]">stopped scrolling</span>.
              </p>
              <p className="t-body-lg text-[var(--fg-2)] mt-5 sm:mt-7 max-w-md">
                a one-person studio. six shipped apps, designed and coded
                solo with ai in every loop. the receipts are below.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="#apps"
                  className="brut-line label-fg px-4 py-3 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
                >
                  see the work ↓
                </Link>
                <Link
                  href="#code"
                  className="brut-line-thin label px-4 py-3 hover:text-[var(--fg)] hover:border-[var(--fg)] transition"
                >
                  the codebase →
                </Link>
                <Link
                  href="https://www.tiktok.com/@klar"
                  target="_blank"
                  className="brut-line-thin label px-4 py-3 hover:text-[var(--fg)] hover:border-[var(--fg)] transition"
                >
                  @klar ↗
                </Link>
              </div>
            </div>

            {/* live, data-backed proof panel */}
            <div className="md:col-span-5">
              <div className="brut-line bg-[var(--bg-2)]">
                {([
                  [String(CB_TOTALS.apps), "apps shipped"],
                  [nf(CB_TOTALS.lines), "lines of code"],
                  [nf(CB_TOTALS.commits), "commits · build/ship/loop"],
                ] as [string, string][]).map(([v, k], i) => (
                  <div
                    key={k}
                    className={`flex items-baseline justify-between px-4 sm:px-5 py-3 sm:py-4 ${
                      i > 0 ? "border-t border-[var(--line)]" : ""
                    }`}
                  >
                    <span className="display text-3xl sm:text-4xl">{v}</span>
                    <span className="label text-right">{k}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* app strip — instant "this is an app studio" signal */}
          <Link
            href="#apps"
            className="mt-10 sm:mt-14 flex items-center gap-3 sm:gap-5 flex-wrap"
            aria-label="see all apps"
          >
            <span className="label shrink-0">the six ↓</span>
            {APPS.map((a) => (
              <span
                key={a.slug}
                className="relative w-11 h-11 sm:w-14 sm:h-14 icon-card"
              >
                <Image
                  src={a.icon}
                  alt={a.name}
                  fill
                  sizes="56px"
                  className="object-contain"
                />
              </span>
            ))}
          </Link>
        </section>

        {/* ─── BLACK STRIPE ACCENT ─── */}
        <div className="invert-block">
          <span>↳ six apps. one person. one signal.</span>
          <span className="hidden sm:inline">scroll ↓</span>
        </div>

        {/* ─────────── APPS (always expanded) ─────────── */}
        <section
          id="apps"
          className="veil-mid px-4 sm:px-6 md:px-12 py-14 sm:py-20 md:py-28 border-b border-[var(--line)] relative z-10"
        >
          <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
            <p className="label">002 // the work.</p>
            <p className="label hidden sm:inline">tap an icon for details</p>
          </div>

          <AppCrest apps={APPS} />

          <div className="border-t border-[var(--line-strong)] mt-10 sm:mt-14">
            {APPS.map((app, i) => (
              <article
                key={app.slug}
                className="border-b border-[var(--line)] py-5 sm:py-6 grid grid-cols-12 gap-3 sm:gap-4 items-center"
              >
                <div className="col-span-1">
                  <span className="label">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <span className="display text-xl sm:text-2xl md:text-3xl">
                    {app.name.toLowerCase()}
                  </span>
                </div>
                <div className="col-span-7 sm:col-span-5">
                  <p className="editorial text-sm sm:text-base md:text-lg text-[var(--fg-2)]">
                    {app.pitch}
                  </p>
                </div>
                <div className="col-span-12 sm:col-span-3 flex items-center justify-end gap-2 sm:gap-3 mt-2 sm:mt-0">
                  <span
                    className="label-fg brut-line-thin px-2 py-1"
                    style={
                      app.status === "LIVE"
                        ? {
                            background: "var(--fg)",
                            color: "var(--bg)",
                            borderColor: "var(--fg)",
                          }
                        : {}
                    }
                  >
                    {app.status}
                  </span>
                  <span className="label hidden md:inline">{app.buildNote}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ─── BRUTAL STRIPE ─── */}
        <div className="invert-block-stripe" aria-hidden="true" />

        {/* ─────────── COLLAPSIBLE SECTIONS ─────────── */}

        {/* Affiliate */}
        <section
          id="affiliate"
          className="veil-mid relative z-10"
        >
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">003 // affiliate.</span>
              <span className="acc-title">affiliate.</span>
              <span className="acc-pitch">got an audience? bring it.</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="max-w-3xl">
                <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3">
                  got an audience?{" "}
                  <span className="text-[var(--fg)]">bring it to klar.</span>
                </p>
                <p className="t-body-lg text-[var(--fg-2)] mb-6 sm:mb-8 max-w-2xl">
                  You promote our apps to your audience, you get paid per
                  install or sub. Niche fits welcome (knitting → yarn-stash,
                  ibs/health → myloo, sport teams → wavelength, gen-z →
                  trubel).
                </p>
                <AffiliateForm />
              </div>
            </div>
          </details>
        </section>

        {/* Consulting */}
        <section id="consulting" className="veil-mid relative z-10">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">004 // consulting.</span>
              <span className="acc-title">consulting.</span>
              <span className="acc-pitch">building something? let&apos;s talk.</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="max-w-3xl">
                <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3">
                  building something?{" "}
                  <span className="text-[var(--fg)]">let&apos;s talk.</span>
                </p>
                <p className="t-body-lg text-[var(--fg-2)] mb-6 sm:mb-8 max-w-2xl">
                  One-person studio means I pick projects carefully. Mobile
                  apps, ai integrations, growth/tiktok systems. Happy to
                  jam if the brief is sharp.
                </p>
                <ConsultingForm />
              </div>
            </div>
          </details>
        </section>

        {/* Coaching */}
        <section id="coaching" className="veil-mid relative z-10">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">005 // coaching.</span>
              <span className="acc-title">coaching.</span>
              <span className="acc-pitch">building solo? let&apos;s fix that.</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="max-w-3xl">
                <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3">
                  stuck shipping solo?{" "}
                  <span className="text-[var(--fg)]">let&apos;s fix that.</span>
                </p>
                <p className="t-body-lg text-[var(--fg-2)] mb-6 sm:mb-8 max-w-2xl">
                  Not consulting where I build it. Coaching where you do, and I
                  help you move faster: shipping solo with ai, app-store, growth
                  and tiktok, the messy 0 → 1 part. Honest take on whether I&apos;m
                  the right person before we start.
                </p>
                <CoachingForm />
              </div>
            </div>
          </details>
        </section>

        {/* Now / GitHub */}
        <section id="now" className="veil-dark relative z-10">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">006 // now.</span>
              <span className="acc-title">now.</span>
              <span className="acc-pitch">build log · auto-fetched</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="grid grid-cols-12 gap-4 sm:gap-8 mb-6 sm:mb-10">
                <div className="col-span-12 md:col-span-7">
                  <p className="editorial t-editorial-lg text-[var(--fg-2)]">
                    what i&apos;m building right now.{" "}
                    <span className="text-[var(--fg)]">live from github.</span>
                  </p>
                </div>
                <div className="col-span-12 md:col-span-5 flex md:items-end md:justify-end gap-3 flex-wrap">
                  <Link
                    href={GITHUB_PROFILE}
                    target="_blank"
                    className="label-fg brut-line-thin px-3 py-1.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
                  >
                    github profile ↗
                  </Link>
                  <Link
                    href={GITHUB_NOW}
                    target="_blank"
                    className="label-fg brut-line-thin px-3 py-1.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
                  >
                    /now repo ↗
                  </Link>
                </div>
              </div>
              <div className="max-w-3xl">
                <NowFeed />
              </div>
            </div>
          </details>
        </section>

        {/* Code */}
        <section id="code" className="veil-mid relative z-10">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">007 // code.</span>
              <span className="acc-title">code.</span>
              <span className="acc-pitch">the receipts, by the numbers</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="mb-6 sm:mb-8 max-w-3xl">
                <p className="editorial t-editorial-lg text-[var(--fg-2)]">
                  not a portfolio of mockups.{" "}
                  <span className="text-[var(--fg)]">shipped, live, in git.</span>
                </p>
                <p className="t-body-lg text-[var(--fg-2)] mt-4 max-w-2xl">
                  Six apps and the rest of the workshop, built solo with ai in
                  every loop. Pulled live from GitHub.
                </p>
              </div>
              <CodebaseView />
            </div>
          </details>
        </section>

        {/* ─── FINAL BLACK ACCENT ─── */}
        <div className="invert-block">
          <span>made by a business student. shipped in public.</span>
          <span className="hidden sm:inline">↗ github</span>
        </div>

        {/* ─────────── FOOTER ─────────── */}
        <footer className="veil-dark px-4 sm:px-6 md:px-12 py-8 sm:py-12 relative z-10">
          <div className="grid grid-cols-12 gap-6 sm:gap-8 mb-6 sm:mb-10">
            <div className="col-span-12 md:col-span-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="display text-3xl sm:text-4xl">klar</span>
                <span className="label">v0.8</span>
              </div>
              <p className="label">
                built solo, with ai in every loop · shipped in public
              </p>
            </div>
            <div className="col-span-6 md:col-span-3">
              <p className="label mb-3">studio</p>
              <Link
                href="#apps"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Apps
              </Link>
              <Link
                href="/log"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Log
              </Link>
              <Link
                href="#affiliate"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Affiliate
              </Link>
              <Link
                href="#consulting"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Consulting
              </Link>
              <Link
                href="#coaching"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Coaching
              </Link>
              <Link
                href="#now"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Now
              </Link>
              <Link
                href="#code"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Code
              </Link>
              <Link
                href="mailto:alainkessler04@gmail.com"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                alainkessler04@gmail.com
              </Link>
            </div>
            <div className="col-span-6 md:col-span-3">
              <p className="label mb-3">social</p>
              <Link
                href="https://www.tiktok.com/@klar"
                target="_blank"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                TikTok ↗
              </Link>
              <Link
                href="https://www.instagram.com/klar"
                target="_blank"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Instagram ↗
              </Link>
              <Link
                href={GITHUB_PROFILE}
                target="_blank"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                GitHub ↗
              </Link>
              <Link
                href={GITHUB_NOW}
                target="_blank"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                /now ↗
              </Link>
            </div>
          </div>
          <div className="pt-5 border-t border-[var(--line)] flex flex-col sm:flex-row justify-between gap-2">
            <p className="label">© 2026 alain kessler · ch</p>
            <p className="label">build / ship / loop</p>
          </div>
        </footer>
      </main>
    </>
  );
}
