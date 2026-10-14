import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { findKlarApp } from "@/lib/klarApps";
import { AppleSvg, PlaySvg } from "./components/StoreBadges";
import DissolveWord from "./components/home/DissolveWord";
import BeamPill from "./components/home/BeamPill";
import Film from "./components/home/Film";
import Site from "./components/home/Site";
import CreatorForm from "./components/home/CreatorForm";
import HeroPhones from "./components/home/HeroPhones";

// getklar.org's front page: the apps, nothing else (Alain's call, 2026-10-01).
// Klar OS, which stood here before, moved to /os and is not linked from here.
//
// Light editorial look since 2026-10-14, after a reference Alain sent (huge
// tight grotesk on a grid, one word breaking into dust, a phone at the bottom).
// Each app gets its own section with logo, film and store screenshots, so the
// studio reads as a brand and not as a list.
//
// Names and lines follow the App Store listings as of 2026-10-01. Icon and
// store link come from lib/klarApps, so an icon swap there reaches this page.
// Films are the apps' App Store header and search videos, screenshots the
// en-US iPhone sets from App Store Connect, both re-encoded into public/home
// (2026-10-14). Nothing is rebuilt in HTML.

export const metadata: Metadata = {
  title: "Klar Studios",
  description:
    "Pocketmate, Anime Vault, My Yarn Stash, Kelva, Basalt and Learnbound. Apps by Klar Studios, made in Switzerland.",
  alternates: { canonical: "/" },
};


type App = {
  id: string;
  name: string;
  kind: string;
  line: string;
  icon: string;
  href: string;
  play?: string;
  soon: boolean;
  film: { wide: string; tall?: string };
  shots: number;
};

function fromRegistry(slug: string) {
  const app = findKlarApp(slug)!;
  return { icon: app.icon, href: app.appStoreUrl!, play: app.playStoreUrl, soon: false };
}

const shot = (id: string, n: number) => `/home/shots/${id}/${String(n).padStart(2, "0")}.webp`;
const film = (name: string) => `/home/films/${name}`;

const APPS: App[] = [
  { id: "pocketmate", name: "Pocketmate", kind: "Couple widget", line: "A home-screen widget for two people who like each other.", ...fromRegistry("myloo"), film: { wide: film("pocketmate-tall") }, shots: 5 },
  { id: "animevault", name: "Anime Vault", kind: "Tracker & list", line: "Talk about anime, keep your list and never miss an episode.", ...fromRegistry("anime-vault"), film: { wide: film("animevault-wide"), tall: film("animevault-tall") }, shots: 4 },
  { id: "yarnstash", name: "My Yarn Stash", kind: "Row counter", line: "A row counter built for the moment your hands are full.", ...fromRegistry("yarn-stash"), film: { wide: film("yarnstash-wide"), tall: film("yarnstash-tall") }, shots: 4 },
  { id: "kelva", name: "Kelva", kind: "Strength & cycle", line: "Your programme stays put. Kelva adjusts today's session to the week you are having.", ...fromRegistry("kelva"), film: { wide: film("kelva-wide"), tall: film("kelva-tall") }, shots: 6 },
  { id: "basalt", name: "Basalt", kind: "Weekly habits", line: "Write down what you want to follow through on, then tick it off on the home screen.", ...fromRegistry("wavelength"), film: { wide: film("basalt-wide") }, shots: 5 },
  { id: "learnbound", name: "Learnbound", kind: "Put your phone in the box", line: "Set a box on your desk and put your phone in. Only the time it stays there counts as study time.", icon: "/learnbound/icon-v2.webp", href: "/learnbound", soon: true, film: { wide: film("learnbound-wide"), tall: film("learnbound-tall") }, shots: 0 },
];

// Creators (getklar.org is the page creators land on from TikTok, Alain 2026-10-14).
// They choose how they are paid; no promo codes, earnings run through their own link.
const DEALS = [
  { title: "Commission", line: "Your own link. You earn a share of every subscription that comes through it." },
  { title: "CPM", line: "A rate per thousand views on the videos you post about one of our apps." },
];
// Test period and DM account: Alain, 2026-10-14.
const TIKTOK = "clairmentklarclear";
const STEPS = [
  "Apply by email with the form, or send us a DM on TikTok.",
  "We match you with an app that fits your audience and start a paid test period: 7 days, $50.",
  "After the test period you post, and get paid the way you picked.",
];
// The app keys klar_inquiries.target_app accepts (myloo = Pocketmate, wavelength = Basalt).
const INQUIRY_SLUG: Record<string, string> = {
  pocketmate: "myloo",
  animevault: "anime-vault",
  yarnstash: "yarn-stash",
  kelva: "kelva",
  basalt: "wavelength",
  learnbound: "learnbound",
};

// `onFilm`: the buttons sit on the dark fade over the film (md and up), so the
// App Store button turns white and the others go glassy-dark.
function StoreButton({ app, onFilm = false }: { app: App; onFilm?: boolean }) {
  if (app.soon) {
    return (
      <Link
        href={app.href}
        className={`inline-flex h-12 items-center rounded-full border px-6 text-[15px] font-medium tracking-[-0.01em] transition ${onFilm ? "border-white/70 text-white hover:bg-white hover:text-[var(--ink)]" : "border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)]"}`}
      >
        Coming soon
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex h-12 items-center gap-2.5 rounded-full px-6 text-[15px] font-medium tracking-[-0.01em] transition hover:opacity-85 ${onFilm ? "bg-white text-[var(--ink)]" : "bg-[var(--ink)] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"}`}
      >
        <AppleSvg size={15} />
        App Store
      </a>
      {app.play && (
        <a
          href={app.play}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex h-12 items-center gap-2.5 rounded-full border px-6 text-[15px] font-medium tracking-[-0.01em] backdrop-blur-xl transition ${onFilm ? "border-white/40 bg-white/15 text-white hover:bg-white/25" : "border-white/70 bg-white/50 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] hover:bg-white/80"}`}
        >
          <PlaySvg size={15} />
          Google Play
        </a>
      )}
    </div>
  );
}

function AppSection({ app, index }: { app: App; index: number }) {
  return (
    <section id={app.id} className="scroll-mt-4 border-t">
      <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 md:px-12 md:py-32">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">
          {String(index + 1).padStart(2, "0")} · {app.kind} · {app.soon ? "Coming soon" : app.play ? "iPhone & Android" : "iPhone"}
        </p>

        {/* Logo, name, line and store buttons sit on the film (Alain: saves space),
            over a dark fade so they read on bright films too. On phones the 3:2
            film only has room for logo and name; line and buttons go below it. */}
        <div className="relative mt-6">
          <Film
            wide={app.film.wide}
            tall={app.film.tall}
            label={`${app.name} film`}
            className="aspect-[3/2] rounded-[24px] bg-[var(--hair)] md:aspect-[21/9] md:rounded-[32px]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[24px] bg-gradient-to-t from-black/70 via-black/25 to-transparent px-5 pb-5 pt-20 md:rounded-b-[32px] md:from-black/75 md:via-black/30 md:px-10 md:pb-10 md:pt-44">
            <div className="flex items-end justify-between gap-10">
              <div className="text-white">
                <Image
                  src={app.icon}
                  alt={`${app.name} icon`}
                  width={72}
                  height={72}
                  className="size-11 rounded-[22.5%] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.5)] md:size-[72px]"
                />
                <h2 className="mt-3 text-[clamp(34px,6.4vw,104px)] font-medium leading-[0.9] tracking-[-0.05em] md:mt-5">
                  {app.name}
                </h2>
                <p className="mt-4 hidden max-w-[40ch] text-[clamp(16px,1.35vw,20px)] leading-[1.3] tracking-[-0.01em] text-white/85 md:block">
                  {app.line}
                </p>
              </div>
              <div className="pointer-events-auto hidden shrink-0 md:block">
                <StoreButton app={app} onFilm />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 md:hidden">
          <p className="text-[18px] leading-[1.3] tracking-[-0.015em] text-[var(--ink-2)]">{app.line}</p>
          <div className="mt-6">
            <StoreButton app={app} />
          </div>
        </div>

        {app.shots > 0 && (
          <div className="home-rail -mx-5 mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 md:mx-0 md:mt-8 md:px-0">
            {Array.from({ length: app.shots }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={shot(app.id, i + 1)}
                alt={`${app.name} screenshot ${i + 1}`}
                width={660}
                height={1434}
                loading="lazy"
                className="h-auto w-[min(58vw,232px)] shrink-0 snap-start rounded-[18px] shadow-[0_24px_50px_-28px_rgba(0,0,0,0.35)]"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Site>
      <main>
        <section className="relative overflow-hidden">
          <div className="home-grid absolute inset-0" aria-hidden="true" />
          <div className="home-glow absolute inset-0" aria-hidden="true" />
          <div className="relative px-5 pt-28 text-center sm:pt-32">
            <p className="text-[13px] font-medium tracking-[-0.005em]">Made in Switzerland</p>
            <h1 className="mt-7 text-[clamp(76px,15.5vw,236px)] font-medium leading-[0.86] tracking-[-0.06em]">
              <span className="block">Klar</span>
              <span className="block">
                <DissolveWord>Studios.</DissolveWord>
              </span>
            </h1>
            <p className="mx-auto mt-9 max-w-[32ch] text-[clamp(17px,1.5vw,21px)] font-medium leading-[1.3] tracking-[-0.02em]">
              Based in Switzerland. These are the apps Klar Studios ships.
            </p>
            <div className="mt-10">
              <BeamPill apps={APPS.map(({ name, icon }) => ({ name, icon }))} />
            </div>
          </div>
          <HeroPhones apps={APPS.map(({ id, name, icon, play, soon }) => ({ id, name, icon, play, soon }))} />
        </section>

        <section id="creators" className="scroll-mt-20 border-t">
          <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 md:px-12 md:py-32">
            <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">For creators</p>
            <h2 className="mt-6 text-[clamp(52px,8vw,128px)] font-medium leading-[0.9] tracking-[-0.055em]">
              Post about our apps.
              <br />
              Get paid.
            </h2>
            <div className="mt-14 grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-16">
              <div>
                <p className="max-w-[34ch] text-[clamp(18px,1.6vw,23px)] leading-[1.3] tracking-[-0.015em] text-[var(--ink-2)]">
                  You pick how you earn: a share of every subscription that comes through your own link, or a rate per
                  thousand views.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {DEALS.map((d) => (
                    <div
                      key={d.title}
                      className="rounded-[24px] border border-white/70 bg-white/50 p-6 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl"
                    >
                      <p className="text-[22px] font-medium tracking-[-0.03em]">{d.title}</p>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-2)]">{d.line}</p>
                    </div>
                  ))}
                </div>
                <ol className="mt-10 space-y-5">
                  {STEPS.map((step, i) => (
                    <li key={step} className="grid grid-cols-[2.5rem_1fr] items-baseline">
                      <span className="text-[13px] tabular-nums text-[var(--ink-3)]">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[17px] leading-snug tracking-[-0.01em]">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-8 max-w-[44ch] border-l-2 border-[var(--ink)] pl-4 text-[14.5px] leading-relaxed text-[var(--ink-2)]">
                  You need at least 1,000 followers and an account that is already warmed up. Starting on a new account,
                  the test period runs longer.
                </p>
              </div>
              <CreatorForm tiktok={TIKTOK} apps={APPS.map((a) => ({ slug: INQUIRY_SLUG[a.id], name: a.name, icon: a.icon }))} />
            </div>
          </div>
        </section>

        <nav id="apps" aria-label="Apps" className="scroll-mt-4 border-t">
          <ul className="home-rail mx-auto flex max-w-[1180px] gap-8 overflow-x-auto px-5 py-10 sm:justify-center sm:px-8 md:gap-12">
            {APPS.map((app) => (
              <li key={app.id} className="shrink-0">
                <a href={`#${app.id}`} className="group flex w-20 flex-col items-center gap-3 text-center">
                  <Image
                    src={app.icon}
                    alt=""
                    width={64}
                    height={64}
                    className="rounded-[22.5%] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.35)] transition group-hover:-translate-y-0.5"
                  />
                  <span className="text-[12.5px] font-medium leading-tight tracking-[-0.01em]">{app.name}</span>
                  {app.soon && <span className="-mt-2 text-[11px] text-[var(--ink-3)]">Coming soon</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {APPS.map((app, i) => (
          <AppSection key={app.id} app={app} index={i} />
        ))}
      </main>
    </Site>
  );
}
