// My Yarn Stash — app home page: /yarnstash
//
// This is the app's official website while it lives under getklar.org (no
// dedicated domain yet). It is the URL entered as "Application home page" in
// the Google Cloud OAuth consent screen and as the marketing/support anchor in
// App Store Connect, so it has to exist, describe the real product, and link
// to the legal pages.
//
// Brand: the app's Atelier direction, not the klar root look — Gloock display
// serif on warm bone, same palette as the invite landing (/i/yarnstash).

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Gloock, Newsreader } from "next/font/google";

export const metadata: Metadata = {
  title: "My Yarn Stash — row counter for knitting & crochet",
  description:
    "A row counter for the moment both hands are full. Tap anywhere to count, repeats that announce themselves, and your yarn stash right next to your project.",
  robots: { index: true, follow: true },
};

const display = Gloock({
  weight: "400",
  subsets: ["latin"],
  variable: "--ys-display",
  display: "swap",
});

const editorial = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--ys-editorial",
  display: "swap",
});

const APP_STORE_URL = "https://apps.apple.com/app/id6761712550";
const CONTACT = "support@getklar.org";

const INK = "#1E1A17";
const BONE = "#FFFDF8";
const PAPER = "#FAF6F0";
const LINE = "#EBE0CE";
const MUTE = "#756B62";
const ROSE = "#B84A5C";

export default function YarnstashHomePage() {
  return (
    <main
      className={`${display.variable} ${editorial.variable} min-h-screen relative z-10`}
      style={{ background: BONE, color: INK }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        {/* Masthead */}
        <div className="flex items-center gap-4 mb-10">
          <Image
            src="/icons/yarnstash.webp"
            alt="My Yarn Stash app icon"
            width={56}
            height={56}
            style={{ borderRadius: 14, border: `1px solid ${LINE}` }}
          />
          <div>
            <div
              style={{
                fontFamily: "var(--ys-display), serif",
                fontSize: 24,
                lineHeight: 1.1,
              }}
            >
              My Yarn Stash
            </div>
            <div style={{ fontSize: 13, color: MUTE }}>
              Row counter for knitting &amp; crochet · iOS
            </div>
          </div>
        </div>

        {/* Hero */}
        <h1
          style={{
            fontFamily: "var(--ys-display), serif",
            fontSize: "clamp(36px, 7vw, 64px)",
            lineHeight: 1.06,
            letterSpacing: "-0.01em",
            marginBottom: 20,
          }}
        >
          Eleven rows into the raglan,{" "}
          <span
            style={{
              fontFamily: "var(--ys-editorial), serif",
              fontStyle: "italic",
              color: ROSE,
            }}
          >
            and the number is gone.
          </span>
        </h1>

        <p style={{ fontSize: 17, lineHeight: 1.6, color: MUTE, maxWidth: 560, marginBottom: 28 }}>
          My Yarn Stash is a row counter for exactly the moment both hands are
          full. No aiming at a small button, no unlocking and squinting. The
          number fills the screen — and the screen is the button.
        </p>

        <a
          href={APP_STORE_URL}
          style={{
            display: "inline-block",
            background: INK,
            color: BONE,
            padding: "13px 26px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 56,
          }}
        >
          Download on the App&nbsp;Store
        </a>

        {/* What it does — honest, matches the shipping app */}
        <div
          style={{
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: "28px 26px",
            marginBottom: 56,
          }}
        >
          <Feature title="Tap anywhere to count">
            A short vibration confirms the row, so your eyes stay on the
            needles. Undo takes back a slip, a lock keeps bags and cats from
            counting along, and the screen stays awake while you work.
          </Feature>
          <Feature title="Repeats that announce themselves">
            Enter it once — increase every 6 rows — and the counter keeps the
            rhythm for you, with a distinct buzz on the row that matters.
          </Feature>
          <Feature title="Side counters, rows and rounds">
            Sleeve, second sock, border: as many extra counters as the project
            needs. Knitting or crochet per project — the counter says rows or
            rounds accordingly.
          </Feature>
          <Feature title="Your yarn, next to your project">
            Every skein with brand, color, weight and yardage, plus photos.
            Premium adds a label scanner and an unlimited stash. Export
            everything as PDF or CSV anytime, free.
          </Feature>
        </div>

        {/* Legal + contact */}
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 24 }}>
          <p
            style={{
              fontSize: 13,
              color: MUTE,
              letterSpacing: "0.04em",
              lineHeight: 2,
            }}
          >
            <Link href="/yarnstash/privacy" className="underline" style={{ color: INK }}>
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/yarnstash/terms" className="underline" style={{ color: INK }}>
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

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontFamily: "var(--ys-display), serif",
          fontSize: 19,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: MUTE, margin: 0 }}>{children}</p>
    </div>
  );
}
