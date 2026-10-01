// Focus Crew — app home page: /focuscrew
//
// The app's website while it lives under getklar.org, and the fallback for its
// universal links: every /focuscrew/* link opens the installed app (see
// .well-known/apple-app-site-association); without the app it lands here.
// Claims follow the build (AI-Brain Projects/Study-Buddies-App/SPEC-v1.md).

import type { Metadata } from "next";
import Image from "next/image";

const LINE = "study live with real people. pick a room, set a timer, and your chibi sits down next to everyone else who is focusing right now.";

export const metadata: Metadata = {
  title: "Focus Crew — study together, live",
  description: LINE,
  robots: { index: true, follow: true },
  openGraph: { title: "Focus Crew — study together, live", description: LINE, images: ["/focuscrew/icon.webp"] },
};

const APP_STORE_URL = "https://apps.apple.com/app/id6778560113";
const CONTACT = "feedback+focuscrew@reply.getklar.org";

const GROUND = "#1A1410";
const INK = "#FFF6EC";
const MUTED = "#C9B8A6";
const SURFACE = "#2A2019";
const ACCENT = "#F4B860";

const FEATURES = [
  ["study rooms", "café, library, beach and a night train. see who is focusing right now and how long they have been at it."],
  ["your chibi", "hairstyles, outfits, accessories and eight skin tones. it sits in the room while you study."],
  ["focus timer", "pomodoro, timer or stopwatch. with pro, the apps you pick stay locked until the session ends."],
  ["exam planner", "subjects, exams and study phases with a countdown, plus stats for every day and week."],
  ["friends and seasons", "add friends by code, cheer postcards, climb the weekly leaderboard and the season pass."],
];

export default function FocusCrewHomePage() {
  return (
    <main style={{ minHeight: "100vh", position: "relative", zIndex: 10, background: GROUND, color: INK, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <Image src="/focuscrew/icon.webp" alt="Focus Crew icon" width={72} height={72} priority style={{ borderRadius: 18 }} />
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Focus Crew</h1>
            <p style={{ color: MUTED, margin: 0 }}>study together, live</p>
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
          sign in with apple, no phone number. accounts from 13. pro: yearly or lifetime.
          <br />
          questions: <a href={`mailto:${CONTACT}`} style={{ color: INK }}>{CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
