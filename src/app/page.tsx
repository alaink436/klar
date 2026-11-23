import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RiGithubFill } from "@remixicon/react";
import { findKlarApp } from "@/lib/klarApps";
import { AppleSvg, PlaySvg } from "./components/StoreBadges";
import BeamPill from "./components/home/BeamPill";
import AppCarousel from "./components/home/AppCarousel";
import Film from "./components/home/Film";
import Site, { SUPPORT_EMAIL } from "./components/home/Site";
import GlassTitle from "./components/home/GlassTitle";
import PhoneStage from "./components/home/PhoneStage";

// getklar.org's front page: consults first, then the apps (since 2026-11-23; from
// 2026-10-01 it was the apps only, and 10-14 to 11-23 also the creator sign-up).
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
    "Consults and collaborations for app builders, and six apps by Klar Studios: Basalt, Kelva, Pocketmate, Learnbound, My Yarn Stash and Anime Vault. Made in Switzerland.",
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
  users: string;
};

function fromRegistry(slug: string) {
  const app = findKlarApp(slug)!;
  return { icon: app.icon, href: app.appStoreUrl!, play: app.playStoreUrl, soon: false };
}

const shot = (id: string, n: number) => `/home/shots/${id}/${String(n).padStart(2, "0")}.webp`;
const film = (name: string) => `/home/films/${name}`;

// Order and the two not to promote: Alain, 2026-10-14.
// `users`: signed-up users from klar_app_stats() in each app's database, rounded
// down, measured 2026-11-23 (Basalt 903, Anime Vault 248, Pocketmate 186, Kelva 133,
// My Yarn Stash 114, Learnbound 30). Below 100 it reads "Under 100 users" (Alain:
// "bei den Apps welche noch nicht so klappen einfach ein unter 100").
// Kelva since its relaunch as a 64-day grid: line, five store screenshots and a
// film panned over them from the en-US store set of 2026-11-05.
const APPS: App[] = [
  { id: "basalt", name: "Basalt", kind: "Weekly habits", line: "Write down what you want to follow through on, then tick it off on the home screen.", ...fromRegistry("wavelength"), film: { wide: film("basalt-wide") }, shots: 5, users: "900+ users" },
  { id: "kelva", name: "Kelva", kind: "64-day grid", line: "One goal, 64 small steps, one a day. Bring your girls.", ...fromRegistry("kelva"), film: { wide: film("kelva-wide"), tall: film("kelva-tall") }, shots: 5, users: "130+ users" },
  { id: "pocketmate", name: "Pocketmate", kind: "Couple widget", line: "A home-screen widget for two people who like each other.", ...fromRegistry("myloo"), film: { wide: film("pocketmate-tall") }, shots: 5, users: "180+ users" },
  { id: "learnbound", name: "Learnbound", kind: "Put your phone in the box", line: "Set a box on your desk and put your phone in. Only the time it stays there counts as study time.", ...fromRegistry("learnbound"), icon: "/learnbound/icon-v2.webp", film: { wide: film("learnbound-wide"), tall: film("learnbound-tall") }, shots: 4, users: "Under 100 users" },
  { id: "yarnstash", name: "My Yarn Stash", kind: "Row counter", line: "A row counter built for the moment your hands are full.", ...fromRegistry("yarn-stash"), film: { wide: film("yarnstash-wide"), tall: film("yarnstash-tall") }, shots: 4, users: "110+ users" },
  { id: "animevault", name: "Anime Vault", kind: "Tracker & list", line: "Talk about anime, keep your list and never miss an episode.", ...fromRegistry("anime-vault"), film: { wide: film("animevault-wide"), tall: film("animevault-tall") }, shots: 4, users: "240+ users" },
];

// The creator section ("Post about Basalt. Get paid.") left the page on 2026-11-23
// (Alain: "das ganze mit dem creator slideshows kannst du wieder rausnehmen. Mach
// dann bitte lieber ein Consult-Page"); signed-in creators still reach /dashboard
// from the header.
// Up for sale (Alain, 2026-11-04: "available to be bought"): a label on the card,
// in the app row and under the hero phone; the card's label opens a mail for an offer.
const FOR_SALE = new Set(["yarnstash", "animevault"]);
const offerMail = (app: App) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Offer for ${app.name}`)}`;
const GITHUB = "https://github.com/alaink436";

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

// One app as a card in the carousel: film with logo, name, line and store
// buttons on it (Alain: saves space), then the store screenshots, cut off like
// the hero phones. The screenshots do not scroll on their own, so sideways
// swipes always move the carousel.
function AppCard({ app, index }: { app: App; index: number }) {
  return (
    <article
      id={app.id}
      className="w-[86vw] max-w-[1100px] shrink-0 snap-center scroll-mt-24 rounded-[30px] border border-white/70 bg-white/45 p-3 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:p-4 md:rounded-[40px] md:p-5"
    >
      <div className="flex items-center justify-between gap-3 px-2 pt-1">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">
          {String(index + 1).padStart(2, "0")} · {app.kind} · {app.soon ? "Coming soon" : app.play ? "iPhone & Android" : "iPhone"} · {app.users}
        </p>
        {FOR_SALE.has(app.id) && (
          <a
            href={offerMail(app)}
            className="shrink-0 rounded-full border border-[var(--ink)] px-3 py-1 text-[12.5px] font-medium tracking-[-0.01em] transition hover:bg-[var(--ink)] hover:text-[var(--paper)]"
          >
            Available to be bought
          </a>
        )}
      </div>

      {/* Over a dark fade so the text reads on bright films too. On phones the
          3:2 film only has room for logo and name; line and buttons go below. */}
      <div className="relative mt-3">
        <Film
          wide={app.film.wide}
          tall={app.film.tall}
          label={`${app.name} film`}
          className="aspect-[3/2] rounded-[22px] bg-[var(--hair)] md:aspect-[21/9] md:rounded-[28px]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-[22px] bg-gradient-to-t from-black/70 via-black/25 to-transparent px-5 pb-5 pt-20 md:rounded-b-[28px] md:from-black/75 md:via-black/30 md:px-9 md:pb-8 md:pt-40">
          <div className="flex items-end justify-between gap-10">
            <div className="text-white">
              <Image
                src={app.icon}
                alt={`${app.name} icon`}
                width={64}
                height={64}
                className="size-11 rounded-[22.5%] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.5)] md:size-16"
              />
              <h2 className="mt-3 text-[clamp(34px,5.6vw,88px)] font-medium leading-[0.9] tracking-[-0.05em] md:mt-4">
                {app.name}
              </h2>
              <p className="mt-3 hidden max-w-[40ch] text-[clamp(15px,1.25vw,19px)] leading-[1.3] tracking-[-0.01em] text-white/85 md:block">
                {app.line}
              </p>
            </div>
            <div className="pointer-events-auto hidden shrink-0 md:block">
              <StoreButton app={app} onFilm />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 px-2 md:hidden">
        <p className="text-[17px] leading-[1.3] tracking-[-0.015em] text-[var(--ink-2)]">{app.line}</p>
        <div className="mt-5">
          <StoreButton app={app} />
        </div>
      </div>

      {app.shots > 0 && (
        <div className="mt-5 grid h-[clamp(170px,21vw,260px)] grid-cols-3 gap-2 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)] md:mt-4 md:grid-cols-5 md:gap-3">
          {Array.from({ length: Math.min(app.shots, 5) }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={shot(app.id, i + 1)}
              alt={`${app.name} screenshot ${i + 1}`}
              width={660}
              height={1434}
              loading="lazy"
              className={`h-auto w-full rounded-[16px] ${i >= 3 ? "hidden md:block" : ""}`}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export default function Home() {
  return (
    <Site>
      <main>
        <section className="relative overflow-hidden">
          <div className="home-grid absolute inset-0" aria-hidden="true" />
          <div className="home-glow absolute inset-0" aria-hidden="true" />
          <div className="home-ray absolute inset-0" aria-hidden="true" />
          <div className="relative px-5 pt-28 text-center sm:pt-32">
            <p className="text-[13px] font-medium tracking-[-0.005em]">Made in Switzerland</p>
            <GlassTitle
              lines={["Klar", "Studios."]}
              className="mx-auto mt-7 aspect-[2.35/1] w-[min(96vw,1040px)]"
            />
            <div className="mt-8">
              <BeamPill apps={APPS.map(({ name, icon }) => ({ name, icon }))} />
            </div>
            {/* Consults right in the hero (Alain, 2026-11-23: "das Consult und Collab
                bitte etwas höher"); 1,600+ is the sum of the users in APPS. */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link
                href="/consult"
                className="inline-flex h-12 items-center rounded-full bg-[var(--ink)] px-7 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85"
              >
                Book a consult
              </Link>
              <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">
                Six apps, 1,600+ users, built by one person.
              </p>
            </div>
          </div>
          <PhoneStage
            apps={APPS.map(({ id, name, icon, play, soon, shots }) => ({
              id,
              name,
              icon,
              play,
              soon,
              forSale: FOR_SALE.has(id),
              shots: Array.from({ length: shots }, (_, i) => shot(id, i + 1)),
            }))}
          />
        </section>

        {/* Consulting and collaborations, large and right under the hero (Alain,
            2026-11-04: "viel grösser", "weiter oben", "verlinke mein GitHub"). */}
        <section id="work" className="border-t">
          <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 md:px-12 md:py-32">
            <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Work with us</p>
            {/* glass in 3D like the hero (Alain, 2026-11-04: "auch noch 3d") */}
            <GlassTitle
              as="h2"
              left
              lines={["Consults &", "Collaborations."]}
              className="mt-6 aspect-[3.4/1] w-full max-w-[1100px]"
            />
            <p className="mt-10 max-w-[34ch] text-[clamp(18px,1.6vw,23px)] leading-[1.3] tracking-[-0.015em] text-[var(--ink-2)]">
              Building an app, or want to make something together? I build and run six apps on my own with AI agents,
              and I can help you do the same.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/consult"
                className="inline-flex h-14 items-center rounded-full bg-[var(--ink)] px-8 text-[16px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85"
              >
                How I work
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Consults & Collaborations")}`}
                className="inline-flex h-14 items-center rounded-full border border-white/70 bg-white/50 px-8 text-[16px] font-medium tracking-[-0.01em] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-white/80"
              >
                Write me
              </a>
              <a
                href={GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-14 items-center gap-2.5 rounded-full border border-white/70 bg-white/50 px-8 text-[16px] font-medium tracking-[-0.01em] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-white/80"
              >
                <RiGithubFill size={18} aria-hidden="true" />
                GitHub
              </a>
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
                  {FOR_SALE.has(app.id) && <span className="-mt-2 text-[11px] leading-tight text-[var(--ink-3)]">Available to be bought</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-label="The apps" className="pb-20 md:pb-28">
          <AppCarousel>
            {APPS.map((app, i) => (
              <AppCard key={app.id} app={app} index={i} />
            ))}
          </AppCarousel>
        </section>
      </main>
    </Site>
  );
}
