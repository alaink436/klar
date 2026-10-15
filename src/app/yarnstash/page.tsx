// My Yarn Stash: app home page, /yarnstash
//
// The app's website while it lives under getklar.org: "Application home page"
// in the Google Cloud OAuth consent screen and the marketing/support anchor in
// App Store Connect, so it describes the real product and links the legal
// pages. Since 2026-10-15 in the shared app layout (components/landing).
//
// Film: the knitted tunnel from the intro (Content/woll-tunnel/renders/
// intro_app.mp4), forward then back so it loops. One phone: there is no
// capture of the current main screen yet.

import AppLanding, { landingMetadata, type Landing } from "../components/landing/AppLanding";

const YARN_STASH: Landing = {
  id: "yarnstash",
  registry: "yarn-stash",
  name: "My Yarn Stash",
  kind: "Row counter",
  headline: "Eleven rows into the raglan, and the number is gone.",
  sub: "A row counter for the moment both hands are full. The number fills the screen, and the screen is the button.",
  features: [
    {
      title: "Tap anywhere to count",
      line: "A short vibration confirms the row, so your eyes stay on the needles. Undo takes back a slip.",
    },
    {
      title: "Repeats that announce themselves",
      line: "Enter it once, increase every 6 rows, and the counter keeps the rhythm with a distinct buzz on the row that matters.",
    },
    {
      title: "Side counters, rows and rounds",
      line: "Sleeve, second sock, border: as many extra counters as the project needs, knitting or crochet.",
    },
    {
      title: "Your yarn, next to your project",
      line: "Every skein with brand, color, weight and yardage, plus photos. Export everything as PDF or CSV anytime.",
    },
  ],
  film: "/yarnstash/tunnel",
  filmLabel: "My Yarn Stash: flying through a knitted tunnel",
  privacy: "/yarnstash/privacy",
  terms: "/yarnstash/terms",
  title: "My Yarn Stash · Row counter for knitting & crochet",
  description:
    "A row counter for the moment both hands are full. Tap anywhere to count, repeats that announce themselves, and your yarn stash right next to your project.",
};

export const metadata = landingMetadata(YARN_STASH);

export default function YarnStashHomePage() {
  return <AppLanding l={YARN_STASH} />;
}
