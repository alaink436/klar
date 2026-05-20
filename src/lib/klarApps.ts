// Slim metadata for the six Klar apps. Single source of truth for:
//   - /admin Overview (App-Tab-Strip + Apps section in sidebar)
//   - /admin/analytics (App-Klick-Attribution auf /i/<slug>/<CODE>)
//   - Klar Marketing page (page.tsx APPS array currently mirrors this;
//     consolidating in a later pass).
//
// Apps that ALSO have a Supabase Affiliate-Schema appear in
// process.env.KLAR_ADMIN_APPS via `AdminApp` (see lib/adminApps). The slugs
// here are the keys for cross-referencing.

export type KlarAppStatus = "LIVE" | "BETA" | "BUILD" | "PLAN";

export interface KlarAppMeta {
  slug: string;
  name: string;
  icon: string;
  status: KlarAppStatus;
  // Path prefix for the Affiliate-Landingpage on getklar.org, e.g. "/i/yarnstash".
  // Used to attribute klar_pageviews back to a specific app.
  affiliatePathPrefix?: string;
}

export const KLAR_APPS: KlarAppMeta[] = [
  { slug: "trubel", name: "Trubel", icon: "/icons/trubel.webp", status: "BUILD" },
  { slug: "myloo", name: "MyLoo", icon: "/icons/myloo.webp", status: "BETA" },
  { slug: "wavelength", name: "Wavelength", icon: "/icons/wavelength.webp", status: "BUILD" },
  {
    slug: "yarn-stash",
    name: "Yarn-Stash",
    icon: "/icons/yarnstash.webp",
    status: "LIVE",
    affiliatePathPrefix: "/i/yarnstash",
  },
  { slug: "kelva", name: "Kelva", icon: "/icons/kelva.webp", status: "BUILD" },
  { slug: "moto", name: "ThrottleUp", icon: "/icons/moto.webp", status: "BUILD" },
];

export function findKlarApp(slug: string): KlarAppMeta | undefined {
  return KLAR_APPS.find((a) => a.slug === slug);
}
