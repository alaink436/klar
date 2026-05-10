import Image from "next/image";
import Link from "next/link";
import AppCrest, { type App } from "./components/AppCrest";
import GlitchWordmark from "./components/GlitchWordmark";
import { AffiliateForm, ConsultingForm } from "./components/Forms";

const APPS: App[] = [
  {
    slug: "trubel",
    name: "Trubel",
    pitch: "drop a pin. fill it with photos.",
    description:
      "Geo-tagged photo albums with a time window, shared via QR code. Guests shoot with their normal camera during the event. At the host-set trigger time the app scans their camera roll for matching photos and proposes them for upload — zero friction during the party. All albums land as pins on a world map.",
    business: {
      free: "3 active albums, 100 photos per album, basic world map",
      paid: "Unlimited albums, 4K downloads, auto-reel highlights, public map visibility",
      price: "tbd",
    },
    status: "BUILD",
    buildNote: "build #2 · y2k onboarding done",
    icon: "/icons/trubel.png",
  },
  {
    slug: "myloo",
    name: "MyLoo",
    pitch: "tracking. without the gross.",
    description:
      "Take a photo, Vision AI classifies it on the Bristol Stool Scale. For people with IBS, Crohn's, colitis and parents who track for doctor's visits — no friction, no judgement. Photos stay local on the device by default; cloud sync is opt-in only.",
    business: {
      free: "5 photo scans / day, 30-day history, manual entries unlimited",
      paid: "Unlimited scans + history, PDF export for doctors, food-diary correlations, trigger detection",
      price: "$4.99/mo or $29.99/yr",
    },
    status: "BETA",
    buildNote: "ASC submitted · in review",
    icon: "/icons/myloo.png",
  },
  {
    slug: "wavelength",
    name: "Wavelength",
    pitch: "plan smarter, together.",
    description:
      "Personal calendar plus voting tool for friend groups and sport teams. Heatmap availability voting, Vision-OCR for paper schedules, sport-specific lineups for 8 sports. The group plan that doesn't annoy.",
    business: {
      free: "2 groups, 5 events per group, manual block creation",
      paid: "Unlimited groups + events, Vision-OCR import, iOS calendar auto-sync, boost",
      price: "tbd",
    },
    status: "BUILD",
    buildNote: "native build #2 · push pending",
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
      paid: "Unlimited stash, yarn-photo scan (no wrapper needed), sharing with friends, PDF/CSV export",
      price: "$3.99/mo or $29.99/yr",
    },
    status: "LIVE",
    buildNote: "v1 · 4★+",
    storeUrl: "https://apps.apple.com/app/yarn-stash",
    icon: "/icons/yarnstash.png",
  },
];

export default function Home() {
  return (
    <>
      {/* ─── GLOBAL LIQUID-METAL BACKGROUND ─── */}
      <div className="bg-stage" aria-hidden="true">
        <div
          className="bg-layer bg-layer-1"
          style={{ backgroundImage: "url('/bg/bg-1.jpg')" }}
        />
        <div
          className="bg-layer bg-layer-2"
          style={{ backgroundImage: "url('/bg/bg-2.jpg')" }}
        />
        <div className="bg-vignette" />
      </div>

      <main className="min-h-screen relative">
        {/* ─────────── NAV ─────────── */}
        <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-5 border-b border-[var(--line)] relative z-20 veil-dark">
          <div className="flex items-baseline gap-2 sm:gap-3">
            <span className="display text-xl sm:text-2xl">klar</span>
            <span className="label hidden sm:inline">v0.4 · ch</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 md:gap-10">
            <Link
              href="#apps"
              className="label hover:text-[var(--fg)] transition"
            >
              apps
            </Link>
            <Link
              href="#work"
              className="label hover:text-[var(--fg)] transition"
            >
              work
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

        {/* ─────────── HERO (light veil — bg most visible here) ─────────── */}
        <section className="veil-light px-4 sm:px-6 md:px-12 pt-12 sm:pt-20 md:pt-32 pb-16 sm:pb-24 md:pb-36 relative z-10 border-b border-[var(--line)]">
          <div className="flex items-baseline justify-between mb-6 sm:mb-10">
            <p className="label">001 // hi.</p>
            <p className="label">bern · ch · since &apos;26</p>
          </div>

          <GlitchWordmark
            text="klar"
            className="t-wordmark text-[var(--fg)] -ml-1 sm:-ml-2"
          />

          <div className="grid grid-cols-12 gap-4 sm:gap-6 mt-10 sm:mt-16 md:mt-20">
            <div className="col-span-1 md:col-span-2 flex justify-center md:justify-end pt-2">
              <span className="label">↳</span>
            </div>
            <div className="col-span-11 md:col-span-7 max-w-2xl">
              <p className="editorial t-editorial-xl">
                we build apps for the
                <br />
                people who never{" "}
                <span className="text-[var(--silver)]">stopped scrolling</span>.
              </p>
              <p className="t-body-lg text-[var(--fg-2)] mt-5 sm:mt-7 max-w-md">
                four apps. one person in the middle. shipped from a kitchen in
                bern, switzerland — between coffee, code, and the occasional
                tiktok loop.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────── APPS (mid veil — metal still visible) ─────────── */}
        <section
          id="apps"
          className="veil-mid px-4 sm:px-6 md:px-12 py-14 sm:py-20 md:py-28 border-b border-[var(--line)] relative z-10"
        >
          <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
            <p className="label">002 // the four.</p>
            <p className="label hidden sm:inline">tap an icon for details</p>
          </div>

          <AppCrest apps={APPS} />

          {/* Apps row */}
          <div className="border-t border-[var(--line-strong)]">
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
                  {app.storeUrl ? (
                    <Link
                      href={app.storeUrl}
                      target="_blank"
                      className="label-fg brut-line-thin px-2 py-1 tap-lift"
                    >
                      app store ↗
                    </Link>
                  ) : (
                    <span className="label">— soon —</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ─────────── WORK (dark veil — readability priority) ─────────── */}
        <section
          id="work"
          className="veil-dark px-4 sm:px-6 md:px-12 py-14 sm:py-20 md:py-28 border-b border-[var(--line)] relative z-10"
        >
          <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
            <p className="label">003 // work with us.</p>
            <p className="label hidden sm:inline">two doors.</p>
          </div>

          <h2 className="display t-display mb-10 sm:mb-14 md:mb-16">
            two ways in.
            <br />
            <span className="editorial text-[var(--fg-3)] font-normal italic">
              pick yours.
            </span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <div>
              <div className="flex items-baseline gap-3 mb-3 sm:mb-4">
                <span className="label">A</span>
                <h3 className="display text-2xl sm:text-3xl md:text-4xl">
                  affiliate
                </h3>
              </div>
              <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3">
                got an audience? <br className="sm:hidden" />
                bring it to klar.
              </p>
              <p className="t-body-lg text-[var(--fg-2)] mb-6 sm:mb-8 max-w-md">
                You promote our apps to your audience, you get paid per install
                or sub. Niche fits welcome (knitting → yarn-stash, ibs/health →
                myloo, sport teams → wavelength, gen-z → trubel).
              </p>
              <AffiliateForm />
            </div>

            <div>
              <div className="flex items-baseline gap-3 mb-3 sm:mb-4">
                <span className="label">B</span>
                <h3 className="display text-2xl sm:text-3xl md:text-4xl">
                  consulting
                </h3>
              </div>
              <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3">
                building something? <br className="sm:hidden" />
                let&apos;s talk.
              </p>
              <p className="t-body-lg text-[var(--fg-2)] mb-6 sm:mb-8 max-w-md">
                One-person studio means I pick projects carefully. Mobile apps,
                ai integrations, growth/tiktok systems — happy to jam if the
                brief is sharp.
              </p>
              <ConsultingForm />
            </div>
          </div>
        </section>

        {/* ─────────── FOOTER ─────────── */}
        <footer className="veil-dark px-4 sm:px-6 md:px-12 py-8 sm:py-12 relative z-10">
          <div className="grid grid-cols-12 gap-6 sm:gap-8 mb-6 sm:mb-10">
            <div className="col-span-12 md:col-span-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="display text-3xl sm:text-4xl">klar</span>
                <span className="label">v0.4</span>
              </div>
              <p className="label">made in bern · coffee + cursor + claude</p>
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
                href="#work"
                className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
              >
                Work with us
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
