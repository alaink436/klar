// Slim metadata for the seven Klar apps. Single source of truth for:
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
}

export const KLAR_APPS: KlarAppMeta[] = [
  { slug: "trubel", name: "Trubel", icon: "/icons/trubel.webp", status: "LIVE" },
  { slug: "myloo", name: "MyLoo", icon: "/icons/myloo.webp", status: "LIVE" },
    // slug stays "wavelength": it is the key into the affiliate schema, the
  // Supabase project and referrals.app. Only the display name changed.
  // BUILD, not LIVE: what is live in the App Store under this bundle is still
  // the old Wavelength calendar app. Basalt has not been submitted yet.
  { slug: "wavelength", name: "Basalt", icon: "/icons/wavelength.webp", status: "BUILD" },
  {
    slug: "yarn-stash",
    name: "Yarn-Stash",
    icon: "/icons/yarnstash.webp",
    status: "LIVE",
  },
  { slug: "kelva", name: "Kelva", icon: "/icons/kelva.webp", status: "LIVE" },
  { slug: "moto", name: "ThrottleUp", icon: "/icons/moto.webp", status: "LIVE" },
  { slug: "promillio", name: "Promillo", icon: "/icons/promillio.png", status: "LIVE" },
];

export function findKlarApp(slug: string): KlarAppMeta | undefined {
  return KLAR_APPS.find((a) => a.slug === slug);
}
