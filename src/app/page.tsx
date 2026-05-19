import Link from "next/link";
import Image from "next/image";
import AppCrest, { type App } from "./components/AppCrest";
import GlitchWordmark from "./components/GlitchWordmark";
import NowFeed from "./components/NowFeed";
import CodebaseView from "./components/CodebaseView";
import Zeitraffer from "./components/Zeitraffer";
import BrainGraph from "./components/BrainGraph";
import HashAccordion from "./components/HashAccordion";
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
      free: "5 photo scans / day, 30-day history, manual entries unlimited, basic trends",
      paid: "Unlimited scans + history, PDF export for doctors, food-diary correlations, trigger detection, health-app sync",
      price: "$4.99/mo · $29.99/yr",
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
      free: "20 yarns, 3 active projects, pattern search, manual entry, wrapper scan (20/day)",
      paid: "Unlimited stash, yarn-photo scan, sharing with friends, PDF/CSV export",
      price: "$3.99/mo · $29.99/yr",
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
    pitch: "every renewal, before it lapses.",
    description:
      "One place for every piece of life admin: warranties, subscriptions, documents, maintenance and deadlines. Smart reminders before anything expires, photograph every receipt, and let AI auto-file forwarded emails and scanned documents. Built because half of all warranty claims are lost to missing receipts.",
    business: {
      free: "15 items, manual entry unlimited, 3 household members, 1 forwarding alias, smart reminders",
      paid: "Unlimited items, AI auto-capture (email + document scan), 6 household members, 5 aliases, vault + subscription dashboard",
      price: "$3.99/mo · $29.99/yr",
    },
    status: "BUILD",
    buildNote: "in review",
    icon: "/icons/kelva.png",
  },
  {
    slug: "moto",
    name: "ThrottleUp",
    pitch: "every service, logged.",
    description:
      "Maintenance and service tracking for motorcycles: oil, chain, tyres and mileage-based reminders, full service history and a shop log. Know exactly when the bike needs what, and prove it when you sell.",
    business: {
      free: "1 bike, full service log, recall alerts",
      paid: "Unlimited bikes, cost analysis, full service-history export, fuel log",
      price: "$3.99/mo · $24.99/yr",
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
      <HashAccordion />

      {/* ─── GLOBAL LIQUID-METAL BACKGROUND ─── */}
      <div className="bg-stage" aria-hidden="true">
        <div className="bg-layer bg-layer-1" style={{ backgroundImage: "url('/bg/bg-1.webp')" }} />
        <div className="bg-layer bg-layer-2" style={{ backgroundImage: "url('/bg/bg-2.webp')" }} />
        <div className="bg-layer bg-layer-3" style={{ backgroundImage: "url('/bg/bg-3.webp')" }} />
        <div className="bg-layer bg-layer-4" style={{ backgroundImage: "url('/bg/bg-4.webp')" }} />
        <div className="bg-vignette" />
      </div>

      <main className="min-h-screen relative">
        {/* ─────────── NAV ─────────── */}
        <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-3 md:py-4 border-b border-[var(--line)] relative z-20 veil-dark">
          <div className="flex items-baseline gap-2 sm:gap-3">
            <span className="display text-lg sm:text-xl">klar</span>
            <span className="label hidden sm:inline">v0.8 · ch</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5 md:gap-7">
            <Link href="#apps" className="label hover:text-[var(--fg)] transition">apps</Link>
            <Link href="#brain" className="label hover:text-[var(--fg)] transition">brain</Link>
            <Link href="#zeitraffer" className="label hidden sm:inline hover:text-[var(--fg)] transition">zeitraffer</Link>
            <Link href="#affiliate" className="label hidden md:inline hover:text-[var(--fg)] transition">affiliate</Link>
            <Link href="#code" className="label hidden md:inline hover:text-[var(--fg)] transition">code</Link>
            <Link href="/log" className="label hidden md:inline hover:text-[var(--fg)] transition">log</Link>
            <Link href={GITHUB_PROFILE} target="_blank" className="label hidden md:inline hover:text-[var(--fg)] transition">github ↗</Link>
            <Link
              href="#consulting"
              className="label-fg brut-line-thin px-2.5 py-1 whitespace-nowrap hover:bg-[var(--fg)] hover:text-[var(--bg)] hover:border-[var(--fg)] transition"
            >
              <span className="sm:hidden">work</span>
              <span className="hidden sm:inline">work with me</span>
            </Link>
            <Link href="https://www.tiktok.com/@klar" target="_blank" className="label-fg flex items-center gap-1.5 group">
              <span className="text-[var(--silver)] group-hover:text-[var(--fg)] transition">●</span>
              @klar
            </Link>
          </div>
        </nav>

        {/* ─────────── HERO (now carries the brain) ─────────── */}
        <section className="veil-light px-4 sm:px-6 md:px-12 pt-8 sm:pt-12 md:pt-16 pb-10 sm:pb-12 md:pb-14 relative z-10 border-b border-[var(--line)]">
          <div className="flex items-baseline justify-between mb-4 sm:mb-6">
            <p className="label">001 // klar studio</p>
            <p className="label">{nf(CB_TOTALS.lines)} lines · solo</p>
          </div>

          <GlitchWordmark text="klar" className="t-wordmark text-[var(--fg)] -ml-1" />

          <div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:items-end">
            <div className="md:col-span-7 max-w-2xl">
              <p className="editorial t-editorial-xl">
                we had zero tech background.
                <br />
                we taught ourselves{" "}
                <span className="text-[var(--silver)]">all of it</span>.
              </p>
              <p className="t-body-lg text-[var(--fg-2)] mt-4 max-w-md">
                no cs degree, no team, no shortcuts. just stubborn, self-taught,
                and good at this now. six apps live, run out of one obsidian
                brain. the receipts are right here.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link href="#apps" className="brut-line label-fg px-4 py-2.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition">
                  see the work ↓
                </Link>
                <Link href="#consulting" className="brut-line label-fg px-4 py-2.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition">
                  work with me →
                </Link>
                <Link href="#affiliate" className="brut-line-thin label px-4 py-2.5 hover:text-[var(--fg)] hover:border-[var(--fg)] transition">
                  affiliate →
                </Link>
                <Link href="#brain" className="brut-line-thin label px-4 py-2.5 hover:text-[var(--fg)] hover:border-[var(--fg)] transition">
                  the brain ↓
                </Link>
              </div>
            </div>

            {/* compact proof panel */}
            <div className="md:col-span-5">
              <div className="brut-line bg-[var(--bg-2)]">
                {([
                  [String(CB_TOTALS.apps), "apps shipped"],
                  [nf(CB_TOTALS.lines), "lines of code"],
                  [nf(CB_TOTALS.commits), "commits · build/ship/loop"],
                ] as [string, string][]).map(([v, k], i) => (
                  <div
                    key={k}
                    className={`flex items-baseline justify-between px-4 sm:px-5 py-2.5 ${
                      i > 0 ? "border-t border-[var(--line)]" : ""
                    }`}
                  >
                    <span className="display text-2xl sm:text-3xl">{v}</span>
                    <span className="label text-right">{k}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* app strip */}
          <Link
            href="#apps"
            className="mt-8 flex items-center gap-3 sm:gap-4 flex-wrap"
            aria-label="see all apps"
          >
            <span className="label shrink-0">the six ↓</span>
            {APPS.map((a) => (
              <span key={a.slug} className="relative w-10 h-10 sm:w-12 sm:h-12 icon-card">
                <Image src={a.icon} alt={a.name} fill sizes="48px" className="object-contain" />
              </span>
            ))}
          </Link>

          {/* the brain, in the hero */}
          <div id="brain" className="mt-8 sm:mt-10 scroll-mt-20">
            <div className="flex items-baseline justify-between mb-3">
              <p className="label">the brain · one obsidian vault, in git</p>
              <p className="label hidden sm:inline">drag · zoom · hover</p>
            </div>
            <BrainGraph />
          </div>
        </section>

        {/* ─── BLACK STRIPE ─── */}
        <div className="invert-block">
          <span>↳ no tech background. self-taught. shipped anyway.</span>
          <span className="hidden sm:inline">scroll ↓</span>
        </div>

        {/* ─────────── APPS ─────────── */}
        <section
          id="apps"
          className="veil-mid px-4 sm:px-6 md:px-12 py-10 sm:py-14 md:py-16 border-b border-[var(--line)] relative z-10 scroll-mt-16"
        >
          <div className="flex items-baseline justify-between mb-6 sm:mb-10">
            <p className="label">002 // the work.</p>
            <p className="label hidden sm:inline">tap an icon for details</p>
          </div>

          <AppCrest apps={APPS} />

          <div className="border-t border-[var(--line-strong)] mt-8 sm:mt-12">
            {APPS.map((app, i) => (
              <article
                key={app.slug}
                className="border-b border-[var(--line)] py-4 sm:py-5 grid grid-cols-12 gap-3 sm:gap-4 items-center"
              >
                <div className="col-span-1">
                  <span className="label">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <span className="display text-lg sm:text-xl md:text-2xl">
                    {app.name.toLowerCase()}
                  </span>
                </div>
                <div className="col-span-7 sm:col-span-5">
                  <p className="editorial text-sm sm:text-base text-[var(--fg-2)]">
                    {app.pitch}
                  </p>
                </div>
                <div className="col-span-12 sm:col-span-3 flex items-center justify-end gap-2 sm:gap-3 mt-1 sm:mt-0">
                  <span
                    className="label-fg brut-line-thin px-2 py-1"
                    style={
                      app.status === "LIVE"
                        ? { background: "var(--fg)", color: "var(--bg)", borderColor: "var(--fg)" }
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

        {/* ─────────── ZEITRAFFER (compact) ─────────── */}
        <section
          id="zeitraffer"
          className="veil-mid px-4 sm:px-6 md:px-12 py-10 sm:py-14 md:py-16 border-b border-[var(--line)] relative z-10 scroll-mt-16"
        >
          <div className="flex items-baseline justify-between mb-4 sm:mb-6">
            <p className="label">003 // zeitraffer.</p>
            <p className="editorial text-sm sm:text-base text-[var(--fg-2)]">
              two months of shipping,{" "}
              <span className="text-[var(--fg)]">on fast-forward</span>.
            </p>
          </div>
          <Zeitraffer />
        </section>

        {/* ─────────── COLLAPSIBLE SECTIONS ─────────── */}

        {/* Affiliate */}
        <section id="affiliate" className="veil-mid relative z-10 scroll-mt-16">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">004 // affiliate.</span>
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
                <p className="t-body-lg text-[var(--fg-2)] mb-6 max-w-2xl">
                  You promote our apps to your audience, you get paid per
                  install or sub. Niche fits welcome (knitting → yarn-stash,
                  ibs/health → myloo, sport teams → wavelength, gen-z → trubel).
                </p>
                <AffiliateForm />
              </div>
            </div>
          </details>
        </section>

        {/* Consulting + Coaching (merged) */}
        <section id="consulting" className="veil-mid relative z-10 scroll-mt-16">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">005 // work with me.</span>
              <span className="acc-title">work with me.</span>
              <span className="acc-pitch">consulting &amp; coaching</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
                <div>
                  <p className="label mb-2">consulting · i build it</p>
                  <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3">
                    building something?{" "}
                    <span className="text-[var(--fg)]">let&apos;s talk.</span>
                  </p>
                  <p className="t-body-lg text-[var(--fg-2)] mb-5">
                    Self-taught and hands-on, so I pick projects carefully.
                    Mobile apps, ai integrations, growth/tiktok systems. Happy
                    to jam if the brief is sharp.
                  </p>
                  <ConsultingForm />
                </div>
                <div id="coaching" className="scroll-mt-16">
                  <p className="label mb-2">coaching · you build it</p>
                  <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3">
                    stuck shipping solo?{" "}
                    <span className="text-[var(--fg)]">let&apos;s fix that.</span>
                  </p>
                  <p className="t-body-lg text-[var(--fg-2)] mb-5">
                    Coaching where you do the building and I help you move
                    faster: shipping solo with ai, app-store, growth and tiktok,
                    the messy 0 → 1 part. Honest take first.
                  </p>
                  <CoachingForm />
                </div>
              </div>
            </div>
          </details>
        </section>

        {/* Now / GitHub */}
        <section id="now" className="veil-dark relative z-10 scroll-mt-16">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">006 // now.</span>
              <span className="acc-title">now.</span>
              <span className="acc-pitch">build log · auto-fetched</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="grid grid-cols-12 gap-4 sm:gap-8 mb-5 sm:mb-8">
                <div className="col-span-12 md:col-span-7">
                  <p className="editorial t-editorial-lg text-[var(--fg-2)]">
                    what i&apos;m building right now.{" "}
                    <span className="text-[var(--fg)]">live from github.</span>
                  </p>
                </div>
                <div className="col-span-12 md:col-span-5 flex md:items-end md:justify-end gap-3 flex-wrap">
                  <Link href={GITHUB_PROFILE} target="_blank" className="label-fg brut-line-thin px-3 py-1.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition">
                    github profile ↗
                  </Link>
                  <Link href={GITHUB_NOW} target="_blank" className="label-fg brut-line-thin px-3 py-1.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition">
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
        <section id="code" className="veil-mid relative z-10 scroll-mt-16">
          <details className="group">
            <summary className="acc-summary">
              <span className="acc-tag">007 // code.</span>
              <span className="acc-title">code.</span>
              <span className="acc-pitch">the receipts, by the numbers</span>
              <span className="acc-toggle" aria-hidden="true" />
            </summary>
            <div className="acc-body">
              <div className="mb-5 sm:mb-7 max-w-3xl">
                <p className="editorial t-editorial-lg text-[var(--fg-2)]">
                  not a portfolio of mockups.{" "}
                  <span className="text-[var(--fg)]">shipped, live, in git.</span>
                </p>
              </div>
              <CodebaseView />
            </div>
          </details>
        </section>

        {/* ─── FINAL BLACK ACCENT ─── */}
        <div className="invert-block">
          <span>taught ourselves to build. shipping in public.</span>
          <span className="hidden sm:inline">↗ github</span>
        </div>

        {/* ─────────── FOOTER ─────────── */}
        <footer className="veil-dark px-4 sm:px-6 md:px-12 py-8 sm:py-10 relative z-10">
          <div className="grid grid-cols-12 gap-6 sm:gap-8 mb-6">
            <div className="col-span-12 md:col-span-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="display text-2xl sm:text-3xl">klar</span>
                <span className="label">v0.8</span>
              </div>
              <p className="label">
                self-taught, no tech background · hard work, shipped in public
              </p>
            </div>
            <div className="col-span-6 md:col-span-3">
              <p className="label mb-3">studio</p>
              {[
                ["#apps", "Apps"],
                ["#brain", "Brain"],
                ["#zeitraffer", "Zeitraffer"],
                ["#consulting", "Work with me"],
                ["#affiliate", "Affiliate"],
                ["#now", "Now"],
                ["#code", "Code"],
                ["/log", "Log"],
                ["mailto:alainkessler04@gmail.com", "alainkessler04@gmail.com"],
              ].map(([href, label]) => (
                <Link
                  key={label}
                  href={href}
                  className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="col-span-6 md:col-span-3">
              <p className="label mb-3">social</p>
              <Link href="https://www.tiktok.com/@klar" target="_blank" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
                TikTok ↗
              </Link>
              <Link href="https://www.instagram.com/klar" target="_blank" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
                Instagram ↗
              </Link>
              <Link href={GITHUB_PROFILE} target="_blank" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
                GitHub ↗
              </Link>
              <Link href={GITHUB_NOW} target="_blank" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
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
