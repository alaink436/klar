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
  /**
   * Key into KLAR_ADMIN_APPS / KLAR_REVENUECAT_KEYS when the backend was
   * inherited from another app. Only set when it differs from `slug`: a
   * recycled Supabase project keeps its historical key everywhere (metrics
   * history, env, routes) while the brand up front is a different app.
   */
  backendSlug?: string;
  /**
   * false = the entry exists ONLY so historical rows (outreach, affiliates,
   * pageviews) still resolve to a name. It is never listed in the admin —
   * otherwise the app whose backend it handed over shows up twice.
   */
  listed?: boolean;
}

export const KLAR_APPS: KlarAppMeta[] = [
  // -v3 = the real App Store icons, supplied 2026-08-16 and resized from the
  // 1024px originals. New filenames rather than new bytes, for the reason
  // spelled out on Anime Vault below: /public is served immutable, so replacing
  // an icon's content changes nothing for anyone who already loaded it.
  {
    slug: "trubel",
    name: "Trubel",
    icon: "/icons/trubel-v3.webp",
    status: "LIVE",
    release: "v1.0.6 · build 16",
    appStoreUrl: "https://apps.apple.com/app/id6766649400",
    publicSite: true,
  },
  {
    slug: "myloo",
    name: "MyLoo",
    icon: "/icons/myloo-v3.webp",
    status: "LIVE",
    release: "v1.0.5 · build 12",
    appStoreUrl: "https://apps.apple.com/app/id6767200261",
    publicSite: true,
  },
  // Runs on promillio's old Supabase project (recycled 2026-06-30), so every
  // backend number — users, funnel, RevenueCat — is keyed `promillio`.
  {
    slug: "anime-vault",
    name: "Anime Vault",
    // -v2 is not cosmetic: Vercel serves /public with `immutable, max-age=1y`,
    // so replacing an icon's BYTES changes nothing for anyone who already
    // loaded the old one. Swapping an icon means a new filename.
    icon: "/icons/animevault-v2.png",
    status: "LIVE",
    release: "v1.1 · build 8",
    appStoreUrl: "https://apps.apple.com/app/id6759915617",
    publicSite: true,
    backendSlug: "promillio",
  },
  {
    slug: "yarn-stash",
    name: "Yarn-Stash",
    icon: "/icons/yarnstash-v3.webp",
    status: "LIVE",
    release: "v1.0.2",
    appStoreUrl: "https://apps.apple.com/app/id6761712550",
    publicSite: true,
  },
  {
    slug: "kelva",
    name: "Kelva",
    icon: "/icons/kelva-v3.webp",
    status: "LIVE",
    appStoreUrl: "https://apps.apple.com/app/id6761271923",
    publicSite: true,
  },
  {
    slug: "moto",
    name: "ThrottleUp",
    icon: "/icons/moto-v3.webp",
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
    // The slug stays historical, the icon does not: this is Basalt's own.
    icon: "/icons/basalt-v3.webp",
    status: "BUILD",
    publicSite: true,
  },
  // Promillo was paused 2026-06-30 and its Supabase project was recycled for
  // Anime Vault. The slug is kept so historical affiliate, outreach and
  // analytics rows still resolve to a name — but `listed: false` keeps it out
  // of every admin list, because Anime Vault now speaks for that backend and
  // showing both put two Anime-Vault rows next to each other.
  {
    slug: "promillio",
    name: "Promillo",
    icon: "/icons/promillio.png",
    status: "PAUSED",
    publicSite: false,
    listed: false,
  },
];

/** Apps shown on the public marketing site, in display order. */
export const PUBLIC_APPS: KlarAppMeta[] = KLAR_APPS.filter((a) => a.publicSite);

/**
 * The roster the admin shows: one row per app that still stands for itself.
 * Use this for every list/table/nav; use KLAR_APPS only to resolve a slug that
 * came out of the database.
 */
export const LISTED_APPS: KlarAppMeta[] = KLAR_APPS.filter((a) => a.listed !== false);

/** Which KLAR_ADMIN_APPS / KLAR_REVENUECAT_KEYS entry feeds this app. */
export function appBackendKey(app: Pick<KlarAppMeta, "slug" | "backendSlug">): string {
  return app.backendSlug ?? app.slug;
}

/**
 * Same question, but answered against the keys that actually exist (an env
 * map, a Set of configured slugs). The env vars are hand-edited, so a recycled
 * backend may sit under the historical key OR have been renamed to the brand
 * slug at some point. Try the historical key, then the brand slug, and fall
 * back to the historical one so the caller always gets a stable string —
 * whichever way the env reads, the app is listed exactly once.
 */
export function resolveBackendKey(
  app: Pick<KlarAppMeta, "slug" | "backendSlug">,
  known: { has(key: string): boolean },
): string {
  const historical = appBackendKey(app);
  if (known.has(historical)) return historical;
  if (known.has(app.slug)) return app.slug;
  return historical;
}

export function findKlarApp(slug: string): KlarAppMeta | undefined {
  return KLAR_APPS.find((a) => a.slug === slug);
}
