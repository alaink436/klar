import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Inter_Tight } from "next/font/google";
import { findKlarApp } from "@/lib/klarApps";
import DissolveWord from "./components/home/DissolveWord";
import Film from "./components/home/Film";

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

const grotesk = Inter_Tight({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Klar · App Studio",
  description:
    "Pocketmate, Anime Vault, My Yarn Stash, Kelva, Basalt and Learnbound. An app studio from Switzerland.",
  alternates: { canonical: "/" },
};

const SUPPORT_EMAIL = "support@getklar.org";

type App = {
  id: string;
  name: string;
  kind: string;
  line: string;
  icon: string;
  href: string;
  soon: boolean;
  film?: { wide: string; tall?: string; fit?: "contain" };
  shots: number;
};

function fromRegistry(slug: string) {
  const app = findKlarApp(slug)!;
  return { icon: app.icon, href: app.appStoreUrl!, soon: false };
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

function AppleMark() {
  return (
    <svg width="15" height="18" viewBox="0 0 22 26" fill="currentColor" aria-hidden="true">
      <path d="M17.55 13.85c0-3.18 2.6-4.7 2.72-4.78-1.48-2.16-3.79-2.46-4.6-2.49-1.96-.2-3.83 1.15-4.83 1.15-1.01 0-2.55-1.12-4.19-1.09-2.16.03-4.15 1.25-5.27 3.18-2.25 3.9-.58 9.66 1.61 12.83 1.07 1.55 2.34 3.29 4.01 3.23 1.61-.06 2.22-1.04 4.17-1.04 1.94 0 2.49 1.04 4.19 1 1.73-.03 2.83-1.58 3.89-3.14 1.22-1.79 1.73-3.53 1.76-3.62-.04-.02-3.38-1.3-3.46-5.13zM14.42 4.34c.88-1.07 1.48-2.55 1.32-4.04-1.27.05-2.83.85-3.74 1.91-.81.94-1.53 2.45-1.34 3.91 1.42.11 2.87-.72 3.76-1.78z" />
    </svg>
  );
}

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
    <a
      href={app.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] transition hover:opacity-85"
    >
      <AppleMark />
      App Store
    </a>
  );
}

function AppSection({ app, index }: { app: App; index: number }) {
  return (
    <section id={app.id} className="scroll-mt-4 border-t">
      <div className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 md:px-12 md:py-32">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">
          {String(index + 1).padStart(2, "0")} · {app.kind}
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
    <div className={`home ${grotesk.variable}`}>
      <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between rounded-full border border-white/60 bg-white/45 pl-2.5 pr-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl backdrop-saturate-150 sm:pr-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/klar-symbol.png" alt="" width={40} height={40} priority className="size-10 object-contain" />
            <span className="text-[19px] font-semibold tracking-[-0.04em]">Klar</span>
          </Link>
          <nav className="flex gap-7 text-[13px] font-medium text-[var(--ink-2)]">
            <a href="#apps" className="transition hover:text-[var(--ink)]">Apps</a>
            <Link href="/support" className="transition hover:text-[var(--ink)]">Support</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="home-grid absolute inset-0" aria-hidden="true" />
          <div className="home-glow absolute inset-0" aria-hidden="true" />
          <div className="relative px-5 pt-28 text-center sm:pt-32">
            <p className="text-[13px] font-medium tracking-[-0.005em]">App Studio · Switzerland</p>
            <h1 className="mt-7 text-[clamp(76px,15.5vw,236px)] font-medium leading-[0.86] tracking-[-0.06em]">
              <span className="block">Klar</span>
              <span className="block">App</span>
              <span className="block">
                <DissolveWord>Studio.</DissolveWord>
              </span>
            </h1>
            <p className="mx-auto mt-9 max-w-[32ch] text-[clamp(17px,1.5vw,21px)] font-medium leading-[1.3] tracking-[-0.02em]">
              Klar is an app studio in Switzerland. These are the apps it ships.
            </p>
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

      <footer className="overflow-hidden border-t">
        <div className="mx-auto max-w-[1400px] px-5 pt-14 sm:px-8 md:px-12">
          <div className="flex flex-col justify-between gap-4 text-[13px] font-medium text-[var(--ink-2)] sm:flex-row">
            <span>App Studio · Switzerland</span>
            <div className="flex flex-wrap gap-6">
              <Link href="/support" className="transition hover:text-[var(--ink)]">Support</Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="transition hover:text-[var(--ink)]">{SUPPORT_EMAIL}</a>
            </div>
          </div>
          <p aria-hidden="true" className="mt-10 select-none text-[clamp(120px,30vw,460px)] font-semibold leading-[0.74] tracking-[-0.075em]">
            Klar
          </p>
          <p className="py-6 text-[12px] text-[var(--ink-3)]">© 2026 Klar · Alain Kessler · Switzerland</p>
        </div>
      </footer>
    </div>
  );
}
