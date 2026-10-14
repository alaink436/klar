import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { findKlarApp } from "@/lib/klarApps";
import { AppleSvg, PlaySvg } from "./components/StoreBadges";
import DissolveWord from "./components/home/DissolveWord";
import BeamPill from "./components/home/BeamPill";
import Film from "./components/home/Film";
import Site from "./components/home/Site";

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
  film?: { wide: string; tall?: string; fit?: "contain" };
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
  { id: "animevault", name: "Anime Vault", kind: "Tracker & list", line: "Talk about anime, keep your list and never miss an episode.", ...fromRegistry("anime-vault"), film: { wide: film("animevault-square"), fit: "contain" }, shots: 4 },
  { id: "yarnstash", name: "My Yarn Stash", kind: "Row counter", line: "A row counter built for the moment your hands are full.", ...fromRegistry("yarn-stash"), shots: 4 },
  { id: "kelva", name: "Kelva", kind: "Strength & cycle", line: "Your programme stays put. Kelva adjusts today's session to the week you are having.", ...fromRegistry("kelva"), film: { wide: film("kelva-wide"), tall: film("kelva-tall") }, shots: 6 },
  { id: "basalt", name: "Basalt", kind: "Weekly habits", line: "Write down what you want to follow through on, then tick it off on the home screen.", ...fromRegistry("wavelength"), film: { wide: film("basalt-wide") }, shots: 5 },
  { id: "learnbound", name: "Learnbound", kind: "Put your phone in the box", line: "Set a box on your desk and put your phone in. Only the time it stays there counts as study time.", icon: "/learnbound/icon.webp", href: "/learnbound", soon: true, shots: 0 },
];

// The hero's fan: one single (unpaired) store screenshot per app, Basalt in the middle.
const FAN = [shot("yarnstash", 3), shot("kelva", 3), shot("basalt", 3), shot("pocketmate", 3), shot("animevault", 3)];
const FAN_POSE = [
  "translate-y-[18%] -rotate-[7deg]",
  "translate-y-[7%] -rotate-[3.5deg]",
  "",
  "translate-y-[7%] rotate-[3.5deg]",
  "translate-y-[18%] rotate-[7deg]",
];

function StoreButton({ app }: { app: App }) {
  if (app.soon) {
    return (
      <Link
        href={app.href}
        className="inline-flex h-12 items-center rounded-full border border-[var(--ink)] px-6 text-[15px] font-medium tracking-[-0.01em] transition hover:bg-[var(--ink)] hover:text-[var(--paper)]"
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
        className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85"
      >
        <AppleSvg size={15} />
        App Store
      </a>
      {app.play && (
        <a
          href={app.play}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/70 bg-white/50 px-6 text-[15px] font-medium tracking-[-0.01em] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-white/80"
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

        {app.film && (
          <Film
            wide={app.film.wide}
            tall={app.film.tall}
            fit={app.film.fit}
            label={`${app.name} film`}
            className={`mt-6 aspect-[3/2] rounded-[24px] md:aspect-[21/9] md:rounded-[32px] ${app.film.fit === "contain" ? "bg-[#060608]" : "bg-[var(--hair)]"}`}
          />
        )}

        <div className="mt-12 grid gap-8 md:mt-16 md:grid-cols-[1.2fr_1fr] md:items-end md:gap-16">
          <div>
            <Image
              src={app.icon}
              alt={`${app.name} icon`}
              width={96}
              height={96}
              className="rounded-[22.5%] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.35)]"
            />
            <h2 className="mt-7 text-[clamp(56px,8.5vw,136px)] font-medium leading-[0.88] tracking-[-0.055em]">
              {app.name}
            </h2>
          </div>
          <div className="md:pb-2">
            <p className="max-w-[34ch] text-[clamp(18px,1.6vw,23px)] leading-[1.3] tracking-[-0.015em] text-[var(--ink-2)]">
              {app.line}
            </p>
            <div className="mt-8">
              <StoreButton app={app} />
            </div>
          </div>
        </div>

        {app.shots > 0 && (
          <div className="home-rail -mx-5 mt-16 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 md:mx-0 md:mt-20 md:px-0">
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
          <div className="relative mx-auto mt-14 flex h-[clamp(210px,30vw,440px)] justify-center gap-[2vw] overflow-x-visible overflow-y-clip px-5 md:mt-20">
            {FAN.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                width={660}
                height={1434}
                className={`h-auto w-[clamp(120px,15vw,215px)] shrink-0 self-start rounded-[16px] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)] ${FAN_POSE[i]} ${i === 0 || i === 4 ? "hidden sm:block" : ""}`}
              />
            ))}
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
