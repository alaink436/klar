// Pocketmate: app page, /pocketmate. The page a creator link opens on a
// computer; the product site stays at pocketmate.getklar.org. Layout and
// banners: components/landing.
//
// Film: an iPhone simulator recording of the doodle screen (MyLoo
// Content/asc/blender/rec); behind it the home screen with the distance widget
// (Content/asc/foto-neu). Claims stay within the App Store listing.

import AppLanding, { landingMetadata, type Landing } from "../components/landing/AppLanding";

const POCKETMATE: Landing = {
  id: "pocketmate",
  registry: "myloo",
  name: "Pocketmate",
  kind: "Couple widget",
  headline: "Always on each other's home screen.",
  sub: "A drawing, a photo, the days until you meet again: your person sees it without opening an app. Made for couples, close by or long distance.",
  features: [
    {
      title: "Widgets for two",
      line: "The latest photo, the newest doodle, a countdown to your next meeting and more, right on the home screen.",
    },
    {
      title: "Draw onto their lock screen",
      line: "Your drawing lands on their lock screen and in the Dynamic Island, and stays there for 30 minutes.",
    },
    {
      title: "Play together",
      line: "A live jigsaw that moves on both phones at once, This or That, and games to pass back and forth.",
    },
    {
      title: "Only for the two of you",
      line: "Status, location and your streak reach your person only once you switch them on. Location is rounded to about 1 km.",
    },
  ],
  film: "/pocketmate/doodle",
  filmLabel: "Pocketmate: a doodle arriving from your person",
  filmHasIsland: true,
  screen: { src: "/pocketmate/screen-widget.webp", alt: "Pocketmate widget on the home screen showing the distance" },
  privacy: "/pocketmate/privacy",
  terms: "/pocketmate/terms",
  title: "Pocketmate · Home screen widgets for two",
  description: "A drawing, a photo, the days until you meet again: your person sees it without opening an app.",
};

export const metadata = landingMetadata(POCKETMATE);

export default function PocketmatePage() {
  return <AppLanding l={POCKETMATE} />;
}
