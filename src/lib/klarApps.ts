// Slim metadata for the Klar apps. Single source of truth for:
//   - /admin Overview (App-Tab-Strip + Apps section in sidebar)
//   - /admin/analytics (App-Klick-Attribution auf /i/<slug>/<CODE>)
//   - Klar Marketing page — page.tsx now READS status, release and store URL
//     from here instead of keeping its own copy. Only the marketing prose
//     (pitch, description, business model) still lives in page.tsx.
//
// Status, release and appStoreUrl are maintained HERE and nowhere else. The
// three lists used to drift apart (2026-08: the marketing page still showed
// Trubel/MyLoo/ThrottleUp as unreleased and Promillo as live) — that is what
// this consolidation prevents.
//
// Apps that ALSO have a Supabase Affiliate-Schema appear in
// process.env.KLAR_ADMIN_APPS via `AdminApp` (see lib/adminApps). The slugs
// here are the keys for cross-referencing.

export type KlarAppStatus = "LIVE" | "BETA" | "BUILD" | "PLAN" | "PAUSED";

export interface KlarAppMeta {
  slug: string;
  name: string;
  icon: string;
  status: KlarAppStatus;
  /** Shipped App Store version + build. Only set for apps that are LIVE. */
  release?: string;
  appStoreUrl?: string;
  /** false = kept for data continuity, but never shown on the public site. */
  publicSite?: boolean;
}

export const KLAR_APPS: KlarAppMeta[] = [
  {
    slug: "trubel",
    name: "Trubel",
    icon: "/icons/trubel.webp",
    status: "LIVE",
    release: "v1.0.6 · build 16",
    appStoreUrl: "https://apps.apple.com/app/id6766649400",
    publicSite: true,
  },
  {
    slug: "myloo",
    name: "MyLoo",
    icon: "/icons/myloo.webp",
    status: "LIVE",
    release: "v1.0.5 · build 12",
    appStoreUrl: "https://apps.apple.com/app/id6767200261",
    publicSite: true,
  },
  {
    slug: "anime-vault",
    name: "Anime Vault",
    icon: "/icons/animevault.png",
    status: "LIVE",
    release: "v1.1 · build 8",
    appStoreUrl: "https://apps.apple.com/app/id6759915617",
    publicSite: true,
  },
  {
    slug: "yarn-stash",
    name: "Yarn-Stash",
    icon: "/icons/yarnstash.webp",
    status: "LIVE",
    release: "v1.0.2",
    appStoreUrl: "https://apps.apple.com/app/id6761712550",
    publicSite: true,
  },
  {
    slug: "kelva",
    name: "Kelva",
    icon: "/icons/kelva.webp",
    status: "LIVE",
    appStoreUrl: "https://apps.apple.com/app/id6761271923",
    publicSite: true,
  },
  {
    slug: "moto",
    name: "ThrottleUp",
    icon: "/icons/moto.webp",
    status: "LIVE",
    release: "v1.0.3 · build 14",
    appStoreUrl: "https://apps.apple.com/app/id6761712527",
    publicSite: true,
  },
  // slug stays "wavelength": it is the key into the affiliate schema, the
  // Supabase project and referrals.app. Only the display name changed.
  // BUILD, not LIVE: what is live in the App Store under this bundle is still
  // the old Wavelength calendar app. Basalt has not been submitted yet.
  {
    slug: "wavelength",
    name: "Basalt",
    icon: "/icons/wavelength.webp",
    status: "BUILD",
    publicSite: true,
  },
  // Promillo was paused 2026-06-30 and its Supabase project was recycled for
  // Anime Vault. The slug is kept so historical affiliate, outreach and
  // analytics rows still resolve to a name — but it is PAUSED, so the outreach
  // "live apps" filter skips it, and publicSite:false keeps it off getklar.org.
  {
    slug: "promillio",
    name: "Promillo",
    icon: "/icons/promillio.png",
    status: "PAUSED",
    publicSite: false,
  },
];

/** Apps shown on the public marketing site, in display order. */
export const PUBLIC_APPS: KlarAppMeta[] = KLAR_APPS.filter((a) => a.publicSite);

export function findKlarApp(slug: string): KlarAppMeta | undefined {
  return KLAR_APPS.find((a) => a.slug === slug);
}
