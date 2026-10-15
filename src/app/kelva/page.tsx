// Kelva: app page, /kelva. The page a creator link opens on a computer; the
// product site stays at kelva.space. Layout and banners: components/landing.
//
// Film: an iPhone simulator recording of a workout (Content/werbung/waist-05);
// behind it the week screen from the store shots (Content/asc/store-shots-
// 2026-10-10). Claims stay within the App Store listing.

import AppLanding, { landingMetadata, type Landing } from "../components/landing/AppLanding";

const KELVA: Landing = {
  id: "kelva",
  registry: "kelva",
  name: "Kelva",
  kind: "Strength & cycle",
  headline: "Some weeks feel twice as heavy.",
  sub: "Kelva keeps your programme and adjusts today's session to your sleep and, if you share it, your cycle.",
  features: [
    {
      title: "Your programme stays put",
      line: "Kelva never rebuilds your plan. What changes is today: a little less volume, a lower target, or a deliberate deload.",
    },
    {
      title: "Sleep and cycle, your way",
      line: "Your sleep from Apple Health against your own average, your cycle day if you share it. Switch either off anytime.",
    },
    {
      title: "Every exercise opened up",
      line: "Step-by-step instructions, the muscles that work, the equipment you need, a substitute and an easier version.",
    },
    {
      title: "Your data stays on your iPhone",
      line: "Sleep, cycle and your daily check-ins are stored and calculated on your device, not on our server.",
    },
  ],
  film: "/kelva/workout",
  filmLabel: "Kelva guiding a workout set by set",
  filmHasIsland: true,
  screen: { src: "/kelva/screen-week.webp", alt: "Kelva: your programme and your week" },
  privacy: "https://kelva.space/privacy",
  terms: "https://kelva.space/terms",
  title: "Kelva · Strength training for women",
  description: "Your programme stays put. Kelva adjusts today's session to your sleep and, if you share it, your cycle.",
};

export const metadata = landingMetadata(KELVA);

export default function KelvaPage() {
  return <AppLanding l={KELVA} />;
}
