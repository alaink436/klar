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

/** Localized brand strings — strings that change per language. brand.name and
 *  brand.short stay identical across languages (App-Names are brand-identity).
 *  Falls back to DE root field when a key is missing for the target lang. */
export interface BrandI18n {
  handTagline?: string;
  pdfTitle?: string;
  pdfHint?: string;
  vibe?: string;
  /** Pain-point clause that reads after the brand name: "{Name} {painpoint}." */
  painpoint?: string;
}

export interface Brand {
  key: BrandKey;
  name: string;
  short: string;
  accent: string;
  vibe: string;
  productLine: string;
  audience: string;
  /** Pain-point clause that reads after the brand name: "{Name} {painpoint}."
   *  Localized via the i18n override map (DE root is the fallback). */
  painpoint: string;
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
  /** Optional per-language overrides for localized strings. */
  i18n?: { en?: BrandI18n; es?: BrandI18n; it?: BrandI18n; fr?: BrandI18n };
}

/** Resolves a localized brand string with DE fallback. */
export function brandText(brand: Brand, key: keyof BrandI18n, lang: "de" | "en" | "es" | "it" | "fr"): string {
  if (lang !== "de") {
    const v = brand.i18n?.[lang]?.[key];
    if (typeof v === "string") return v;
  }
  return brand[key] as string;
}

export type BrandKey = "yarnstash" | "throttleup" | "wavelength" | "kelva" | "trubel" | "myloo" | "promillio";

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
  promillio:  (s) => `https://getklar.org/i/promillio/${encodeURIComponent(s)}`,
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
    painpoint: "behält deinen Garn-Vorrat und alle Projekte im Blick, damit du nie doppelt kaufst oder etwas vergisst",
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
    i18n: {
      es: {
        handTagline: "bienvenida ✿",
        pdfTitle: "Playbook estratégico",
        pdfHint: "Formatos de hook, scripts de Reels, calendario de 30 días",
        vibe: "Atelier cálido, paper-flooded, italic editorial",
      },
      en: {
        handTagline: "welcome ✿",
        pdfTitle: "Strategy Playbook",
        pdfHint: "Hook formats, Reels scripts, 30-day calendar",
      },
    },
    secondStream: {
      kind: "yarn-shop",
      label: "Garn-Provisionen",
      sublabel: "Garn-Käufe über Awin via In-App-Shop",
      rateLabel: "Aktive Garn-Käufer (% der Installs)",
      basketLabel: "Avg Garn-Bestellung pro Monat",
      basketUnit: "€",
      defaultRate: 40,
      defaultBasket: 55,
      rateMin: 5, rateMax: 80, rateStep: 1,
      basketMin: 10, basketMax: 200, basketStep: 5,
      commissionRate: 0.0375,
      hint: "7,5 % Shop-Provision × 50 % Creator-Anteil = 3,75 % vom Korb",
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
    painpoint: "dokumentiert jedes Teil und jeden Umbau an deinem Auto, statt Zettel- und Foto-Chaos",
    productPrice: "39 €",
    productPriceShort: "39 €",
    commissionPct: 50,
    attributionMonths: 24,
    streamLabel: "Premium-Verkäufe",
    iconUrl: "/icons/moto.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1bfDThWKo42aV19VxxaTwtp7ekkoT4OwC?usp=sharing",
    mascot: null,
    glyph: { letter: "TU", italic: false },
    pdfTitle: "Creator Playbook",
    pdfHint: "Build-Story Hooks, Garage-B-Roll, Spec-Drop-Framework",
    domain: "throttleup.app",
    handTagline: "let it rip",
    i18n: {
      en: {
        handTagline: "let it rip",
        pdfTitle: "Creator Playbook",
        pdfHint: "Build-story hooks, garage B-roll, spec-drop framework",
        vibe: "Garage workshop, mechanical brutalist",
      },
      es: {
        handTagline: "dale gas",
        pdfTitle: "Creator Playbook",
        pdfHint: "Build-Story Hooks, garage B-roll, framework de spec-drop",
        vibe: "Taller de garaje, brutalismo mecánico",
      },
      it: {
        handTagline: "spingi a tavoletta",
        pdfTitle: "Creator Playbook",
        pdfHint: "Hook di build-story, B-roll garage, framework spec-drop",
        vibe: "Officina garage, brutalismo meccanico",
      },
      fr: {
        handTagline: "à fond",
        pdfTitle: "Creator Playbook",
        pdfHint: "Hooks de build-story, B-roll garage, framework spec-drop",
        vibe: "Atelier garage, brutalisme mécanique",
      },
    },
  },
  wavelength: {
    key: "wavelength",
    name: "Wavelength",
    short: "Wavelength",
    accent: "Blue",
    vibe: "Calm productivity, modern dark SaaS",
    productLine: "Focus + deep-work tracker",
    audience: "Indie hackers, makers, focused professionals",
    painpoint: "findet per Heatmap-Voting den Termin, der wirklich allen passt, plus eigene Module für 8 Sportarten",
    productPrice: "8 €/mo",
    productPriceShort: "8 €",
    commissionPct: 50,
    attributionMonths: 24,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/wavelength.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1TZREwEopAZkJE_XkbCpTAKfScUpevWg1?usp=sharing",
    mascot: null,
    glyph: { letter: "W", italic: false },
    pdfTitle: "Creator Brief",
    pdfHint: "Productivity hooks, before/after carousels, weekly retro template",
    domain: "wavelength.so",
    handTagline: "stay in flow",
    i18n: {
      en: {
        handTagline: "stay in flow",
        pdfTitle: "Creator Brief",
        pdfHint: "Productivity hooks, before/after carousels, weekly retro template",
        vibe: "Calm productivity, modern dark SaaS",
      },
      es: {
        handTagline: "fluye",
        pdfTitle: "Creator Brief",
        pdfHint: "Hooks de productividad, carruseles antes/después, plantilla de retro semanal",
        vibe: "Productividad calma, SaaS dark moderno",
      },
      it: {
        handTagline: "resta in flow",
        pdfTitle: "Creator Brief",
        pdfHint: "Hook di produttività, caroselli prima/dopo, template retro settimanale",
        vibe: "Produttività calma, SaaS dark moderno",
      },
      fr: {
        handTagline: "reste dans le flow",
        pdfTitle: "Creator Brief",
        pdfHint: "Hooks de productivité, carrousels avant/après, template retro hebdo",
        vibe: "Productivité calme, SaaS dark moderne",
      },
    },
  },
  kelva: {
    key: "kelva",
    name: "Kelva",
    short: "Kelva",
    accent: "Indigo",
    vibe: "Editorial calm, Apple-Health-clean, premium glass",
    productLine: "Cycle + hormone literacy",
    audience: "Wellness creators, women-health educators",
    painpoint: "hilft dir, deinen Zyklus zu verstehen, ruhig, fundiert und ohne deine Daten zu verkaufen",
    productPrice: "6 €/mo",
    productPriceShort: "6 €",
    commissionPct: 50,
    attributionMonths: 24,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/kelva.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1zM38-mAqxciYRcxdVa3Mnerp4QEGI7ff?usp=sharing",
    mascot: null,
    glyph: { letter: "K", italic: true },
    pdfTitle: "Editorial Brief",
    pdfHint: "Long-form caption frames, soft-launch script, science-backed angles",
    domain: "kelva.app",
    handTagline: "a gentler signal",
    i18n: {
      en: {
        handTagline: "a gentler signal",
        pdfTitle: "Editorial Brief",
        pdfHint: "Long-form caption frames, soft-launch script, science-backed angles",
        vibe: "Editorial calm, Apple-Health-clean, premium glass",
      },
      es: {
        handTagline: "una señal más suave",
        pdfTitle: "Editorial Brief",
        pdfHint: "Frames de caption largos, script de soft-launch, ángulos con base científica",
        vibe: "Calma editorial, limpio tipo Apple Health, glass premium",
      },
      it: {
        handTagline: "un segnale più dolce",
        pdfTitle: "Editorial Brief",
        pdfHint: "Frame di caption lunghi, script di soft-launch, angoli science-backed",
        vibe: "Calma editoriale, pulito stile Apple Health, glass premium",
      },
      fr: {
        handTagline: "un signal plus doux",
        pdfTitle: "Editorial Brief",
        pdfHint: "Frames de caption longs, script de soft-launch, angles avec base scientifique",
        vibe: "Calme éditorial, propre style Apple Health, glass premium",
      },
    },
  },
  trubel: {
    key: "trubel",
    name: "Trubel",
    short: "Trubel",
    accent: "Sky",
    vibe: "Y2K zine cutout, party, sticker-collage",
    productLine: "Group-chat plans + chaos coordinator",
    audience: "Group-trip planners, party people, Gen-Z friend leaders",
    painpoint: "plant Gruppen-Trips und Pläne, ohne dass jemand in 200 Chat-Nachrichten untergeht",
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
    i18n: {
      en: {
        handTagline: "lets gooo",
        pdfTitle: "Sticker Pack & Brief",
        pdfHint: "Stitch hooks, screenshot-meme frames, in-app cap captures",
        vibe: "Y2K zine cutout, party, sticker collage",
      },
      es: {
        handTagline: "vamos ya",
        pdfTitle: "Sticker Pack & Brief",
        pdfHint: "Hooks de stitch, frames de screenshot-meme, capturas in-app",
        vibe: "Cutout zine Y2K, fiesta, collage de stickers",
      },
      it: {
        handTagline: "andiamoo",
        pdfTitle: "Sticker Pack & Brief",
        pdfHint: "Hook di stitch, frame di screenshot-meme, capture in-app",
        vibe: "Cutout zine Y2K, festa, collage di sticker",
      },
      fr: {
        handTagline: "on y va",
        pdfTitle: "Sticker Pack & Brief",
        pdfHint: "Hooks de stitch, frames de screenshot-meme, captures in-app",
        vibe: "Cutout zine Y2K, fête, collage de stickers",
      },
    },
    secondStream: {
      kind: "album-buy",
      label: "4k-Album-Käufe",
      sublabel: "One-Shot Premium-Memory-Drops",
      rateLabel: "Album-Käufer (% der Installs)",
      basketLabel: "Album-Preis",
      basketUnit: "€",
      defaultRate: 12,
      defaultBasket: 24,
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
    painpoint: "lässt dich Bauch und Verdauung tracken, diskret und ohne Tabu",
    productPrice: "5 €/mo",
    productPriceShort: "5 €",
    commissionPct: 50,
    attributionMonths: 24,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/myloo.webp",
    assetsDriveUrl: "https://drive.google.com/drive/folders/1g7wdnwhl3vXFlXEA4PxhX__IbNFHV2bX?usp=sharing",
    mascot: null,
    glyph: { letter: "M", italic: true },
    pdfTitle: "Quiet Creator Brief",
    pdfHint: "Sensitive-topic framing, day-in-life scripts, privacy claims sheet",
    domain: "myloo.health",
    handTagline: "with care",
    i18n: {
      en: {
        handTagline: "with care",
        pdfTitle: "Quiet Creator Brief",
        pdfHint: "Sensitive-topic framing, day-in-life scripts, privacy claims sheet",
        vibe: "Editorial light, privacy-first, Apple-Health-clean",
      },
      es: {
        handTagline: "con cuidado",
        pdfTitle: "Quiet Creator Brief",
        pdfHint: "Encuadre para temas sensibles, scripts day-in-life, hoja de claims de privacidad",
        vibe: "Editorial ligero, privacy-first, limpio tipo Apple Health",
      },
      it: {
        handTagline: "con cura",
        pdfTitle: "Quiet Creator Brief",
        pdfHint: "Framing per temi sensibili, script day-in-life, scheda claim privacy",
        vibe: "Editorial leggero, privacy-first, pulito stile Apple Health",
      },
      fr: {
        handTagline: "avec soin",
        pdfTitle: "Quiet Creator Brief",
        pdfHint: "Cadrage pour sujets sensibles, scripts day-in-life, fiche claims privacy",
        vibe: "Éditorial léger, privacy-first, propre style Apple Health",
      },
    },
  },
  promillio: {
    key: "promillio",
    name: "Promillo",
    short: "Promillo",
    accent: "Rot",
    vibe: "Splash party, balloon red, 3D animal crew",
    productLine: "Party + drinking games on one phone",
    audience: "Party creators, students, Gen-Z nightlife",
    painpoint: "macht aus jedem Vorglühen sofort ein Partyspiel: 7 Spiele auf einem Handy, ohne Material, ohne Vorbereitung",
    productPrice: "4,99 €/mo",
    productPriceShort: "4,99 €",
    commissionPct: 50,
    attributionMonths: 24,
    streamLabel: "Premium-Abos",
    iconUrl: "/icons/promillio.png",
    assetsDriveUrl: null,
    mascot: "/affiliate-mascots/promillio/unicorn.png",
    glyph: { letter: "P", italic: false },
    pdfTitle: "Party Playbook",
    pdfHint: "Party-Hooks, POV-Reels-Skripte, Vorglüh-Szenen",
    domain: "getklar.org/promillo",
    handTagline: "lass laufen 🎉",
    i18n: {
      en: {
        handTagline: "lets party 🎉",
        pdfTitle: "Party Playbook",
        pdfHint: "Party hooks, POV reel scripts, pregame scenes",
        vibe: "Splash party, balloon red, 3D animal crew",
        painpoint: "turns any pregame into a party game: 7 games on one phone, no gear, no prep",
      },
      es: {
        handTagline: "a darle 🎉",
        pdfTitle: "Party Playbook",
        pdfHint: "Hooks de fiesta, scripts de reels POV, escenas de previa",
        vibe: "Splash party, rojo globo, crew de animales 3D",
        painpoint: "convierte cualquier previa en un juego de fiesta: 7 juegos en un móvil, sin material, sin preparación",
      },
      it: {
        handTagline: "si parte 🎉",
        pdfTitle: "Party Playbook",
        pdfHint: "Hook da festa, script di reel POV, scene di pregame",
        vibe: "Splash party, rosso palloncino, crew di animali 3D",
        painpoint: "trasforma ogni pregame in un party game: 7 giochi su un telefono, senza materiale, senza preparazione",
      },
      fr: {
        handTagline: "que la fête commence 🎉",
        pdfTitle: "Party Playbook",
        pdfHint: "Hooks de fête, scripts de reels POV, scènes de before",
        vibe: "Splash party, rouge ballon, crew d'animaux 3D",
        painpoint: "transforme chaque before en jeu de fête : 7 jeux sur un téléphone, sans matériel, sans préparation",
      },
    },
  },
};

export const STEPS = [
  { key: "welcome",  label: "Willkommen" },
  { key: "tracking", label: "Tracking" },
  { key: "payout",   label: "Auszahlung" },
  { key: "sign",     label: "Signieren" },
  { key: "live",     label: "Live" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
