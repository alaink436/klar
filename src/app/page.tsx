import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { findKlarApp } from "@/lib/klarApps";

// getklar.org's front page: the apps, nothing else (Alain's call, 2026-10-01).
// Klar OS, which stood here before, moved to /os and is not linked from here.
//
// Names and lines follow the App Store listings as of 2026-10-01. Icon and
// store link come from lib/klarApps, so an icon swap there reaches this page.
// Focus Crew is not in lib/klarApps and not in the store yet, so it links to
// its own page.

export const metadata: Metadata = {
  title: "Klar · Indie App Studio",
  description:
    "Pocketmate, Anime Vault, My Yarn Stash, Kelva, Basalt and Focus Crew. A one-person app studio from Switzerland.",
  alternates: { canonical: "/" },
};

const SUPPORT_EMAIL = "support@getklar.org";

function fromRegistry(slug: string) {
  const app = findKlarApp(slug)!;
  return { icon: app.icon, href: app.appStoreUrl!, soon: false };
}

const APPS = [
  { name: "Pocketmate", kind: "couple widget", line: "A home-screen widget for two people who like each other.", ...fromRegistry("myloo") },
  { name: "Anime Vault", kind: "tracker & list", line: "Talk about anime, keep your list and never miss an episode.", ...fromRegistry("anime-vault") },
  { name: "My Yarn Stash", kind: "row counter", line: "A row counter built for the moment your hands are full.", ...fromRegistry("yarn-stash") },
  { name: "Kelva", kind: "strength & cycle", line: "Your programme stays put. Kelva adjusts today's session to the week you are having.", ...fromRegistry("kelva") },
  { name: "Basalt", kind: "weekly habits", line: "Write down what you want to follow through on, then tick it off on the home screen.", ...fromRegistry("wavelength") },
  { name: "Learnbound", kind: "put your phone in the box", line: "Set a box on your desk and put your phone in. Only the time it stays there counts as study time.", icon: "/learnbound/icon.webp", href: "/learnbound", soon: true },
];

export default function Home() {
  return (
    <>
      <div className="bg-stage" aria-hidden="true">
        <div className="bg-layer bg-layer-1" style={{ backgroundImage: "url('/bg/bg-1.webp')" }} />
        <div className="bg-layer bg-layer-3" style={{ backgroundImage: "url('/bg/bg-3.webp')" }} />
        <div className="bg-vignette" />
      </div>

      <main className="min-h-screen relative">
        <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-5 border-b border-[var(--line)] relative z-20 veil-dark">
          <Link href="/" className="flex items-baseline gap-2 sm:gap-3">
            <span className="display text-xl sm:text-2xl">klar</span>
            <span className="label hidden sm:inline">indie app studio</span>
          </Link>
          <Link href="/support" className="label hover:text-[var(--fg)] transition">
            support
          </Link>
        </nav>

        <section className="veil-light px-4 sm:px-6 md:px-12 pt-14 sm:pt-20 md:pt-28 pb-12 sm:pb-16 relative z-10 border-b border-[var(--line)]">
          <p className="label mb-6 sm:mb-10">klar // apps.</p>
          <h1 className="display text-[clamp(2.5rem,9vw,6rem)] leading-[0.95] text-[var(--fg)] -ml-1">
            the apps.
          </h1>
          <p className="editorial t-editorial-lg text-[var(--fg-2)] mt-8 max-w-2xl">
            klar is a one-person studio in switzerland. these are the apps it ships.
          </p>
        </section>

        <section className="veil-mid px-4 sm:px-6 md:px-12 py-12 sm:py-16 relative z-10 border-b border-[var(--line)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {APPS.map((app) => (
              <a
                key={app.name}
                href={app.href}
                {...(app.soon ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                className="group block"
              >
                <Card className="h-full flex flex-col bg-black/40 border-[var(--line)] rounded-none shadow-none transition group-hover:border-[var(--fg-3)]">
                  <CardHeader className="flex-row items-center gap-4">
                    <Image
                      src={app.icon}
                      alt=""
                      width={64}
                      height={64}
                      className="rounded-[22%] shrink-0"
                    />
                    <div>
                      <CardTitle className="text-xl sm:text-2xl">{app.name}</CardTitle>
                      <p className="label mt-1">{app.kind}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <CardDescription className="editorial text-base text-[var(--fg-2)]">
                      {app.line}
                    </CardDescription>
                  </CardContent>
                  <CardFooter className="justify-start">
                    <span className="label group-hover:text-[var(--fg)] transition">
                      {app.soon ? "coming soon →" : "app store →"}
                    </span>
                  </CardFooter>
                </Card>
              </a>
            ))}
          </div>
        </section>

        <footer className="veil-dark px-4 sm:px-6 md:px-12 py-8 sm:py-10 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <span className="display text-2xl sm:text-3xl">klar</span>
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <Link href="/support" className="label hover:text-[var(--fg)] transition">
                support
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="label hover:text-[var(--fg)] transition">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <p className="label mt-6">© 2026 alain kessler · ch</p>
        </footer>
      </main>
    </>
  );
}
