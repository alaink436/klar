// Brand presets — content-level metadata for each app.
// Visual tokens (colors, fonts, radii) live in affiliate-onboarding.css via
// [data-brand="..."] rules. This file only holds copy + asset paths +
// commission/pricing/stream config that the steps and the calculator read.

export interface SecondStream {
  kind: "yarn-shop" | "album-buy";
  label: string;
  sublabel: string;
  rateLabel: string;
  basketLabel: string;
  basketUnit: string;
  defaultRate: number;
  defaultBasket: number;
  rateMin: number;
  rateMax: number;
  rateStep: number;
  basketMin: number;
  basketMax: number;
  basketStep: number;
  commissionRate: number;
  hint: string;
  recurring: boolean;
}

export interface Brand {
  key: BrandKey;
  name: string;
  short: string;
  accent: string;
  vibe: string;
  productLine: string;
  audience: string;
  productPrice: string;
  productPriceShort: string;
  commissionPct: number;
  attributionMonths: number;
  streamLabel: string;
  iconUrl: string;
  /** Public Google Drive folder with brand assets (logo, screenshots,
   *  cheat sheet, playbook PDF). Filled in once the user creates the
   *  per-app folder, null until then. */
  assetsDriveUrl?: string | null;
  mascot: string | null;
  mascotHappy?: string | null;
  mascotSurprised?: string | null;
  glyph: { letter: string; italic: boolean };
  pdfTitle: string;
  pdfHint: string;
  domain: string;
  handTagline: string;
  secondStream?: SecondStream;
}

export type BrandKey = "yarnstash" | "throttleup" | "wavelength" | "kelva" | "trubel" | "myloo";

// Source-of-truth for the public tracking-landing host per app. The Step 4
// "Live" panel in the onboarding reads this, AND the server-side
// confirmation email composer in /api/affiliate/complete reuses the same
// table so the URL the influencer sees in the UI matches what arrives in
// their inbox.
//
// Yarn-Stash + ThrottleUp live on klar (no sister-web repo). The other four
// apps still own their sister-domain for the tracking-landing only — the
// onboarding itself was consolidated to klar, but the bio-link target keeps
// pointing at the per-app domain so each install-referrer pipeline (Awin,
// Branch-less clipboard, /r/ for Kelva) stays where it was already wired.
export const TRACKING_HOST_BY_BRAND: Record<BrandKey, (slug: string) => string> = {
  yarnstash:  (s) => `https://getklar.org/i/yarnstash/${encodeURIComponent(s)}`,
  throttleup: (s) => `https://getklar.org/i/throttleup/${encodeURIComponent(s)}`,
  wavelength: (s) => `https://onwavelength.space/i/${encodeURIComponent(s)}`,
  kelva:      (s) => `https://kelva.space/r/${encodeURIComponent(s)}`,
  trubel:     (s) => `https://trubel.space/i/${encodeURIComponent(s)}`,
  myloo:      (s) => `https://myloo.org/i/${encodeURIComponent(s)}`,
};

export function getTrackingUrl(brand: BrandKey, slug: string): string {
  return TRACKING_HOST_BY_BRAND[brand](slug);
}

export const BRANDS: Record<BrandKey, Brand> = {
  yarnstash: {
    key: "yarnstash",
    name: "My Yarn Stash",
    short: "Yarn-Stash",
    accent: "Rose",
    vibe: "Warm atelier, paper-flooded, editorial italic",
    productLine: "Knit + crochet stash tracker",
    audience: "Knitters, crocheters, fibre artists",
    productPrice: "4,99 €/mo",
    productPriceShort: "4,99 €",
    commissionPct: 50,
    attributionMonths: 24,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/yarnstash.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1fTAhUKHpiPj_xkdBFhN89Fv5ekxVf5oC?usp=sharing",
    mascot: "/affiliate-mascots/yarnstash/cat_knitting.png",
    mascotHappy: "/affiliate-mascots/yarnstash/cat_happy.png",
    mascotSurprised: "/affiliate-mascots/yarnstash/cat_surprised.png",
    glyph: { letter: "Y", italic: false },
    pdfTitle: "Strategie-Playbook",
    pdfHint: "Hook-Formate, Reels-Skripte, 30-Tage-Kalender",
    domain: "yarn-stash.app",
    handTagline: "willkommen ✿",
    secondStream: {
      kind: "yarn-shop",
      label: "Garn-Provisionen",
      sublabel: "Garn-Käufe über Awin via In-App-Shop",
      rateLabel: "Aktive Garn-Käufer (% der Installs)",
      basketLabel: "Avg Garn-Bestellung pro Monat",
      basketUnit: "€",
      defaultRate: 30,
      defaultBasket: 40,
      rateMin: 5, rateMax: 80, rateStep: 1,
      basketMin: 10, basketMax: 200, basketStep: 5,
      commissionRate: 0.0375,
      hint: "7,5 % Shop-Provision × 50 % Affiliate-Anteil = 3,75 % vom Korb",
      recurring: true,
    },
  },
  throttleup: {
    key: "throttleup",
    name: "ThrottleUp",
    short: "ThrottleUp",
    accent: "Amber",
    vibe: "Garage workshop, mechanical brutalist",
    productLine: "Car-build log + parts ledger",
    audience: "Wrenchers, project-car owners, tuners",
    productPrice: "39 €",
    productPriceShort: "39 €",
    commissionPct: 25,
    attributionMonths: 12,
    streamLabel: "Premium-Verkäufe",
    iconUrl: "/icons/moto.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1bfDThWKo42aV19VxxaTwtp7ekkoT4OwC?usp=sharing",
    mascot: null,
    glyph: { letter: "TU", italic: false },
    pdfTitle: "Creator Playbook",
    pdfHint: "Build-Story Hooks, Garage-B-Roll, Spec-Drop-Framework",
    domain: "throttleup.app",
    handTagline: "let it rip",
  },
  wavelength: {
    key: "wavelength",
    name: "Wavelength",
    short: "Wavelength",
    accent: "Blue",
    vibe: "Calm productivity, modern dark SaaS",
    productLine: "Focus + deep-work tracker",
    audience: "Indie hackers, makers, focused professionals",
    productPrice: "8 €/mo",
    productPriceShort: "8 €",
    commissionPct: 30,
    attributionMonths: 12,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/wavelength.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1TZREwEopAZkJE_XkbCpTAKfScUpevWg1?usp=sharing",
    mascot: null,
    glyph: { letter: "W", italic: false },
    pdfTitle: "Creator Brief",
    pdfHint: "Productivity hooks, before/after carousels, weekly retro template",
    domain: "wavelength.so",
    handTagline: "stay in flow",
  },
  kelva: {
    key: "kelva",
    name: "Kelva",
    short: "Kelva",
    accent: "Indigo",
    vibe: "Editorial calm, Apple-Health-clean, premium glass",
    productLine: "Cycle + hormone literacy",
    audience: "Wellness creators, women-health educators",
    productPrice: "6 €/mo",
    productPriceShort: "6 €",
    commissionPct: 28,
    attributionMonths: 12,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/kelva.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1zM38-mAqxciYRcxdVa3Mnerp4QEGI7ff?usp=sharing",
    mascot: null,
    glyph: { letter: "K", italic: true },
    pdfTitle: "Editorial Brief",
    pdfHint: "Long-form caption frames, soft-launch script, science-backed angles",
    domain: "kelva.app",
    handTagline: "a gentler signal",
  },
  trubel: {
    key: "trubel",
    name: "Trubel",
    short: "Trubel",
    accent: "Sky",
    vibe: "Y2K zine cutout, party, sticker-collage",
    productLine: "Group-chat plans + chaos coordinator",
    audience: "Group-trip planners, party people, Gen-Z friend leaders",
    productPrice: "4,99 €/mo",
    productPriceShort: "4,99 €",
    commissionPct: 50,
    attributionMonths: 24,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/trubel.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1ZV-ExYXZIK7vCedYKCMLvHkMZxtcsgPp?usp=sharing",
    mascot: null,
    glyph: { letter: "TR", italic: false },
    pdfTitle: "Sticker Pack & Brief",
    pdfHint: "Stitch hooks, screenshot-meme frames, in-app cap captures",
    domain: "trubel.club",
    handTagline: "lets gooo",
    secondStream: {
      kind: "album-buy",
      label: "4k-Album-Käufe",
      sublabel: "One-Shot Premium-Memory-Drops",
      rateLabel: "Album-Käufer (% der Installs)",
      basketLabel: "Album-Preis",
      basketUnit: "€",
      defaultRate: 8,
      defaultBasket: 19,
      rateMin: 1, rateMax: 30, rateStep: 1,
      basketMin: 9, basketMax: 49, basketStep: 1,
      commissionRate: 0.5,
      hint: "Einmalverkauf, 50 % Anteil pro Album",
      recurring: false,
    },
  },
  myloo: {
    key: "myloo",
    name: "MyLoo",
    short: "MyLoo",
    accent: "Indigo",
    vibe: "Editorial light, privacy-first, Apple-Health-clean",
    productLine: "Bathroom habit + gut log",
    audience: "Health-curious, gut-issue creators, parents",
    productPrice: "5 €/mo",
    productPriceShort: "5 €",
    commissionPct: 26,
    attributionMonths: 12,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/myloo.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1g7wdnwhl3vXFlXEA4PxhX__IbNFHV2bX?usp=sharing",
    mascot: null,
    glyph: { letter: "M", italic: true },
    pdfTitle: "Quiet Creator Brief",
    pdfHint: "Sensitive-topic framing, day-in-life scripts, privacy claims sheet",
    domain: "myloo.health",
    handTagline: "with care",
  },
};

export const STEPS = [
  { key: "welcome",  label: "Willkommen" },
  { key: "tracking", label: "Tracking" },
  { key: "payout",   label: "Auszahlung" },
  { key: "live",     label: "Live" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
