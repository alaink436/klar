// Basalt - Follow Through: app home page, /basalt
//
// The app's website while it lives under getklar.org, and the page a creator
// link opens on a computer. Layout and banners: components/landing/AppLanding.
//
// The film is the App Store header (Content/asc/header-styles/aether), scaled
// to 80 % so the big stone stays whole on a tall screen, haze extended above
// and below. The routines screen is a simulator capture from the store shots
// (Content/asc/store-shots-2026-10-09/pick). Claims stay within the listing.

import AppLanding, { landingMetadata, type Landing } from "../components/landing/AppLanding";

const BASALT: Landing = {
  id: "basalt",
  registry: "wavelength",
  name: "Basalt",
  kind: "Weekly habits",
  headline: "Your routine actually gets done.",
  sub: "Write down what you want to follow through on and how many times a week. Then tick it off on your home screen.",
  features: [
    {
      title: "Ticked off in the widget",
      line: "Check in from the home screen without opening the app. Most days, that is all you do.",
    },
    {
      title: "Weekly, not daily",
      line: "Three runs a week, one call home on Sunday. A missed Tuesday is a missed Tuesday, not a reason to quit.",
    },
    {
      title: "A routine can end",
      line: "Give it a span if you want one. When the span is over, the routine is done. Finished, not abandoned.",
    },
    {
      title: "Shut what pulls at you",
      line: "Lock the apps and sites that eat your hour, on demand or every night. Basalt never learns what you picked.",
    },
  ],
  film: "/basalt/stones",
  filmLabel: "Basalt stones turning from black to frosted glass",
  screen: { src: "/basalt/screen-home.webp", alt: "Basalt: your routines with this week's check-ins" },
  privacy: "/basalt/privacy",
  terms: "/basalt/terms",
  note: "Data stored in the European Union.",
  title: "Basalt - Follow Through · Weekly habits in a widget",
  description:
    "Write down what you want to follow through on and how many times a week. Then tick it off on your home screen.",
};

export const metadata = landingMetadata(BASALT);

export default function BasaltHomePage() {
  return <AppLanding l={BASALT} />;
}
