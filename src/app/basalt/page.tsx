// Basalt - Follow Through — app home page: /basalt
//
// This is the app's official website while it lives under getklar.org (no
// dedicated domain). It is the marketing/landing anchor for the App Store
// listing and the link-in-bio target for the social accounts, so it has to
// exist, describe the real product, and link to the legal pages.
//
// Brand: the app's own design v3, not the klar root look — Figtree on white,
// text #111111, monochrome, no accent colour, lowercase throughout. Every
// claim is lifted from ASC-LISTING.md (the approved store copy), nothing is
// promised that the app does not ship.
//
// Structure mirrors src/app/yarnstash/page.tsx (the other app that homes here).

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Figtree } from "next/font/google";

export const metadata: Metadata = {
  title: "Basalt - Follow Through — habit tracker in a widget",
  description:
    "You decide how many times a week. You tick it off on the home screen. A routine can have an end, and then it is done. No feed, no points, nothing to scroll.",
  robots: { index: true, follow: true },
};

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--ba-sans",
  display: "swap",
});

const APP_STORE_URL = "https://apps.apple.com/app/id6762440839";
const CONTACT = "support@getklar.org";

// src/theme/palette.ts light, verbatim.
const INK = "#111111";
const PAPER = "#FFFFFF";
const SURFACE = "#F7F7F8";
const LINE = "#E0E0E3";
const MUTE = "#9C9CA1";

export default function BasaltHomePage() {
  return (
    <main
      className={`${figtree.variable} min-h-screen relative z-10`}
      style={{
        background: PAPER,
        color: INK,
        fontFamily: "var(--ba-sans), system-ui, sans-serif",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16 sm:py-24">
        {/* Masthead */}
        <div className="flex items-center gap-4 mb-10">
          <Image
            src="/icons/basalt-v3.webp"
            alt="Basalt app icon"
            width={56}
            height={56}
            style={{ borderRadius: 14, border: `1px solid ${LINE}` }}
          />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              basalt
            </div>
            <div style={{ fontSize: 13, color: MUTE, fontWeight: 500 }}>
              habit tracker in a widget · iOS
            </div>
          </div>
        </div>

        {/* Hero — the listing's own opening line. */}
        <h1
          style={{
            fontWeight: 800,
            fontSize: "clamp(36px, 7vw, 64px)",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            marginBottom: 20,
          }}
        >
          most days,{" "}
          <span style={{ color: MUTE }}>you won&apos;t open this app.</span>
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: MUTE,
            fontWeight: 500,
            maxWidth: 560,
            marginBottom: 28,
          }}
        >
          you write down what you want to follow through on, and how many times
          a week. then you tick it off on the home screen. that is the whole
          interaction.
        </p>

        <a
          href={APP_STORE_URL}
          style={{
            display: "inline-block",
            background: INK,
            color: PAPER,
            padding: "13px 26px",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            marginBottom: 56,
          }}
        >
          download on the app&nbsp;store
        </a>

        {/* What it does — the approved store copy, condensed, nothing added. */}
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            borderRadius: 18,
            padding: "28px 26px",
            marginBottom: 56,
          }}
        >
          <Feature title="more than one routine">
            run several at once, each with its own weekly frequency. three runs
            a week, one call home on sunday, twenty minutes of reading on
            weekdays. they sit side by side, no ranking, no main one.
          </Feature>
          <Feature title="a routine can end">
            give a routine a target span if you want one. when the span is
            over, the routine is done. finished, not abandoned — a missed
            tuesday is a missed tuesday, not a reason to delete the app.
          </Feature>
          <Feature title="the widget is the product">
            check in from the home screen, without opening anything. the app is
            where you set a routine up, look at the plan, and change what it
            asks of you. most days you never get that far.
          </Feature>
          <Feature title="one person, read only">
            share a single routine with one person, by code or QR. they can see
            how it is going. they cannot edit it, cannot nudge you, cannot take
            it over. it is a window, not a handle.
          </Feature>
          <Feature title="when the phone is the thing in the way">
            basalt can shut the apps and websites that pull at you — on demand
            when you want an hour back, or on a schedule at night. you pick
            what gets shut in apple&apos;s own screen time picker, and the app
            never learns what you picked. this part is the paid upgrade;
            routines, check-ins, the widget, the plan and sharing are free and
            stay free.
          </Feature>
          <Feature title="quiet on purpose">
            monochrome, no accent colour, follows light and dark. no feed, no
            profile, no points, no leaderboard, nothing to scroll. the app has
            no reason to keep you in it.
          </Feature>
        </div>

        {/* Legal + contact */}
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 24 }}>
          <p
            style={{
              fontSize: 13,
              color: MUTE,
              fontWeight: 500,
              letterSpacing: "0.02em",
              lineHeight: 2,
            }}
          >
            <Link href="/basalt/privacy" className="underline" style={{ color: INK }}>
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/basalt/terms" className="underline" style={{ color: INK }}>
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
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 6 }}>
        {title}
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: MUTE, fontWeight: 500, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
