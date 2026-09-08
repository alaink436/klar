// Podify — app home page: /podify
//
// The app's official website while it lives under getklar.org: the landing
// anchor for the App Store listing and the link-in-bio target. It has to
// exist, describe the real product, and link to the legal pages.
//
// Brand: the pod's own look, the inverse of Basalt's white page — Figtree on
// black, white ink, monochrome, no accent colour, lowercase throughout, Title
// Case only on the menu rows. Every claim follows the build: what Pro is comes
// from podify's src/lib/pro.ts, the extras from src/pod/apps/ids.ts, the ways
// in from targets/PodifyWidget/README.md. Spotify and CarPlay are not in the
// build and the page says so.
//
// Structure mirrors src/app/basalt/page.tsx.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Figtree } from "next/font/google";

import Wheel from "./Wheel";

const HERO_LINE =
  "a click wheel, cover flow, your apple music. and a focus mode that shuts the apps you pick while the music plays.";

export const metadata: Metadata = {
  title: "Podify — the iPod, on your iPhone",
  description: HERO_LINE,
  robots: { index: true, follow: true },
  openGraph: {
    title: "Podify — the iPod, on your iPhone",
    description: HERO_LINE,
    images: ["/podify/ring.webp"],
  },
};

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--pf-sans",
  display: "swap",
});

const APP_STORE_URL = "https://apps.apple.com/app/id6778560113";
const CONTACT = "support@getklar.org";

// The pod's dark palette, verbatim.
const GROUND = "#000000";
const INK = "#FFFFFF";
const MUTED = "#8E8E97";
const FAINT = "#7C7C84";
const SURFACE = "#1B1B1F";
const LINE = "#2A2A30";
const GLASS = "rgba(255,255,255,0.07)";
const GLASS_EDGE = "rgba(255,255,255,0.12)";

export default function PodifyHomePage() {
  return (
    <main
      className={`${figtree.variable} min-h-screen relative z-10`}
      style={{
        background: GROUND,
        color: INK,
        fontFamily: "var(--pf-sans), system-ui, sans-serif",
      }}
    >
      <style>{`
        html { scroll-behavior: smooth; }
        .pf-poster { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .pf-loop { display: none; }
          .pf-poster { display: block; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        {/* Masthead */}
        <div className="flex items-center gap-4 mb-12">
          <Image
            src="/podify/icon.webp"
            alt="Podify app icon"
            width={56}
            height={56}
            style={{ borderRadius: 14, border: `1px solid ${LINE}` }}
          />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              podify
            </div>
            <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>
              the iPod, on your iPhone · iOS
            </div>
          </div>
        </div>

        {/* Hero — the logo, floating on the black ground. */}
        <div className="flex justify-center mb-10">
          <div style={{ width: "100%", maxWidth: 420, aspectRatio: "1 / 1", borderRadius: 32, overflow: "hidden" }}>
            <video
              className="pf-loop"
              autoPlay
              muted
              loop
              playsInline
              poster="/podify/ring.webp"
              aria-label="the podify logo: a glossy ring with a light running around it"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            >
              <source src="/podify/hello-loop.mp4" type="video/mp4" />
            </video>
            <Image
              className="pf-poster"
              src="/podify/ring.webp"
              alt="the podify logo: a glossy ring around a frosted play triangle"
              width={1050}
              height={1050}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>

        <h1
          className="text-center"
          style={{
            fontWeight: 800,
            fontSize: "clamp(40px, 8vw, 72px)",
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            marginBottom: 20,
          }}
        >
          the iPod is back.
          <br />
          <span style={{ color: MUTED }}>it&apos;s your iPhone.</span>
        </h1>

        <p
          className="mx-auto text-center"
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: MUTED,
            fontWeight: 500,
            maxWidth: 520,
            marginBottom: 28,
          }}
        >
          {HERO_LINE}
        </p>

        <div className="flex flex-col items-center gap-3" style={{ marginBottom: 12 }}>
          <a
            href={APP_STORE_URL}
            style={{
              display: "inline-block",
              background: INK,
              color: GROUND,
              padding: "13px 26px",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            download on the app&nbsp;store
          </a>
          <span style={{ fontSize: 12, color: FAINT, fontWeight: 500 }}>coming to the app store</span>
        </div>
        <div className="text-center" style={{ marginBottom: 80 }}>
          <a
            href="#wheel"
            style={{
              display: "inline-block",
              color: INK,
              padding: "10px 18px",
              borderRadius: 999,
              border: `1px solid ${LINE}`,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            see how it works
          </a>
        </div>

        {/* The wheel, for real */}
        <section id="wheel" style={{ scrollMarginTop: 40, marginBottom: 80 }}>
          <Heading>the wheel, for real</Heading>
          <Wheel />
          <p
            className="text-center"
            style={{ fontSize: 15, color: MUTED, fontWeight: 500, marginTop: 28 }}
          >
            turn it. that is the whole interface.
          </p>
        </section>

        {/* The phone */}
        <section style={{ marginBottom: 80 }}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 sm:gap-10">
            <div className="w-full sm:w-1/2" style={{ maxWidth: 520 }}>
              <Image
                src="/podify/hero.webp"
                alt="an iPhone with the pod on screen: the display above, the click wheel below"
                width={1200}
                height={1500}
                priority
                sizes="(max-width: 640px) 100vw, 520px"
                style={{ width: "100%", height: "auto" }}
              />
            </div>
            <div
              className="w-full sm:w-1/2"
              style={{
                background: SURFACE,
                border: `1px solid ${LINE}`,
                borderRadius: 18,
                padding: "28px 26px",
              }}
            >
              <Feature title="your music, on a wheel">
                your apple music library, playlists, search and cover flow, all on
                the click wheel. spotify: coming, when spotify says yes.
              </Feature>
              <Feature title="focus shuts the phone up">
                the apps you pick stay shut while the music plays. you pick them in
                apple&apos;s own screen time picker, and the pod never learns which.
                lifting it is always in your hands.
              </Feature>
              <Feature title="everything the iPod had, and the phone's best bits" last>
                weather, clock and alarms, calendar, contacts, photos, videos, maps,
                notes, calculator, brick and music quiz.
              </Feature>
            </div>
          </div>
        </section>

        {/* From the lock screen */}
        <section style={{ marginBottom: 80 }}>
          <Heading>from the lock screen</Heading>
          <div className="flex flex-col-reverse sm:flex-row items-center gap-8 sm:gap-10">
            <div
              className="w-full"
              style={{
                background: GLASS,
                border: `1px solid ${GLASS_EDGE}`,
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <Way title="lock screen">
                a control in the corner, and widgets under the clock. holding the
                corner opens the pod without unlocking into the phone.
              </Way>
              <Way title="action button">
                set the button to open podify. one press, the pod.
              </Way>
              <Way title="home screen" last>
                a now playing widget: title, artist, play or pause. a tap opens the pod.
              </Way>
            </div>
            <div style={{ width: 220, flexShrink: 0 }}>
              <Image
                src="/podify/front.webp"
                alt="an iPhone with the pod on screen, straight on"
                width={1050}
                height={1313}
                sizes="220px"
                style={{ width: "100%", height: "auto" }}
              />
            </div>
          </div>
        </section>

        {/* Pro */}
        <section
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: "28px 26px",
            marginBottom: 56,
          }}
        >
          <Feature title="free">the music, the wheel, every extra. always.</Feature>
          <Feature title="pro" last>
            focus, three more bodies, the glow. a year or once, for good.
          </Feature>
        </section>

        {/* Legal + contact */}
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 24 }}>
          <p
            style={{
              fontSize: 13,
              color: MUTED,
              fontWeight: 500,
              letterSpacing: "0.02em",
              lineHeight: 2,
            }}
          >
            <Link href="/podify/privacy" className="underline" style={{ color: INK }}>
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/podify/terms" className="underline" style={{ color: INK }}>
              Terms of Use
            </Link>
            {" · "}
            <a href={`mailto:${CONTACT}`} className="underline" style={{ color: INK }}>
              {CONTACT}
            </a>
            <br />
            Made by Alain Kessler (Switzerland), operating as{" "}
            <Link href="/" className="underline" style={{ color: INK }}>
              Klar
            </Link>
            . Data stored in the European Union.
          </p>
        </div>
      </div>
    </main>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-center"
      style={{
        fontSize: "clamp(26px, 4.5vw, 36px)",
        fontWeight: 800,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        marginBottom: 32,
      }}
    >
      {children}
    </h2>
  );
}

function Feature({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 22 }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 6 }}>
        {title}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: MUTED, fontWeight: 500, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

function Way({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: last ? "none" : `1px solid ${GLASS_EDGE}` }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: MUTED, fontWeight: 500, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
