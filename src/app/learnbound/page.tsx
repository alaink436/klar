// Learnbound app home page: /learnbound (the app was called Focus Crew until 8 October 2026)
//
// The app's website while it lives under getklar.org, and the fallback for its
// universal links: every /learnbound/* link opens the installed app (see
// .well-known/apple-app-site-association); without the app it lands here.
// Claims follow the build (AI-Brain Projects/Pod/specs/learnbound-umbau/spec.md).

import type { Metadata } from "next";
import Image from "next/image";

const LINE = "put your phone in a box on your desk. only the time it stays there counts as verified study time.";

export const metadata: Metadata = {
  title: "Learnbound · put your phone in the box",
  description: LINE,
  robots: { index: true, follow: true },
  openGraph: { title: "Learnbound · put your phone in the box", description: LINE, images: ["/learnbound/icon.webp"] },
};

const APP_STORE_URL = "https://apps.apple.com/app/id6778560113";
const CONTACT = "feedback+learnbound@reply.getklar.org";

const GROUND = "#1A1410";
const INK = "#FFF6EC";
const MUTED = "#C9B8A6";
const SURFACE = "#2A2019";
const ACCENT = "#F4B860";

const FEATURES = [
  ["the box", "point your camera at your desk, set a box and put your phone in. the camera only looks while you place it and never records."],
  ["lift it, and it shows", "outside a break, picking up the phone starts an interruption. chill, focused or exam: you choose how strict it is."],
  ["app lock", "with pro, the apps you pick stay locked while you study."],
  ["exam planner", "every exam with a countdown and a minute goal. mock exams run in one block, like the real thing."],
  ["study rooms, if you like", "sit down in a cozy room with others. they see when you are on your phone, and friends can nudge you back."],
];

export default function LearnboundHomePage() {
  return (
    <main style={{ minHeight: "100vh", position: "relative", zIndex: 10, background: GROUND, color: INK, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <Image src="/learnbound/icon.webp" alt="Learnbound icon" width={72} height={72} priority style={{ borderRadius: 18 }} />
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Learnbound</h1>
            <p style={{ color: MUTED, margin: 0 }}>put your phone in the box</p>
          </div>
        </div>

        <p style={{ fontSize: 20, lineHeight: 1.6, marginBottom: 32 }}>{LINE}</p>

        <a
          href={APP_STORE_URL}
          style={{ display: "inline-block", borderRadius: 999, padding: "12px 24px", fontWeight: 700, marginBottom: 56, background: ACCENT, color: GROUND, textDecoration: "none" }}
        >
          get it on the app store
        </a>

        <div style={{ display: "grid", gap: 12, marginBottom: 56 }}>
          {FEATURES.map(([title, text]) => (
            <div key={title} style={{ borderRadius: 16, padding: 20, background: SURFACE }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{title}</h2>
              <p style={{ color: MUTED, margin: 0, lineHeight: 1.5 }}>{text}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.6, color: MUTED }}>
          sign in with apple, no phone number. accounts from 13. the box is free. pro: monthly, yearly or lifetime.
          <br />
          questions: <a href={`mailto:${CONTACT}`} style={{ color: INK }}>{CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
