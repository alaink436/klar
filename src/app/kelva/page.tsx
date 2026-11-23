// Kelva: app page, /kelva. The page a creator link opens on a computer; the
// product site stays at kelva.space. Layout and banners: components/landing.
//
// Film: the current app (1.4.8 screens of 2026-11-14) sliding from Home to the
// grid to the progress photos; behind it the grid screen. Claims stay within the
// App Store listing (read 2026-11-23). The strength-training copy and the workout
// film of the old app were replaced on 2026-11-23.

import AppLanding, { landingMetadata, type Landing } from "../components/landing/AppLanding";

const KELVA: Landing = {
  id: "kelva",
  registry: "kelva",
  name: "Kelva",
  kind: "64-day challenge",
  headline: "One goal. 64 small steps.",
  sub: "Your goal in the middle, eight life areas around it, eight small fields in each. Every day one new field opens, and your friends see when your day is done.",
  features: [
    {
      title: "A ready grid or your own",
      line: "My best self, glow up, healthy body, calm mind, that girl routine, confidence. Or write every field yourself.",
    },
    {
      title: "Your day on one list",
      line: "Your open fields, some movement and a progress photo. Tick it all off and today's field lights up.",
    },
    {
      title: "Bring your friends",
      line: "Invite them with a link. They see whose day is done, never your words, your goal or your cycle.",
    },
    {
      title: "Bad days still count",
      line: "On your period or a sick day a lighter list still counts. Missed one? Tick off yesterday until noon.",
    },
  ],
  film: "/kelva/tour",
  filmLabel: "Kelva: today's list, the 64-field grid and the progress photos",
  filmHasIsland: true,
  screen: { src: "/kelva/screen-grid.webp", alt: "Kelva: your grid on day 38 of 64" },
  privacy: "https://kelva.space/privacy",
  terms: "https://kelva.space/terms",
  title: "Kelva · 64 Day Challenge",
  description: "A 64-day challenge on a grid: one goal, eight life areas, one new field a day, with your friends.",
};

export const metadata = landingMetadata(KELVA);

export default function KelvaPage() {
  return <AppLanding l={KELVA} />;
}
