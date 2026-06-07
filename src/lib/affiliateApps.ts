// SERVER + SHARED. Small per-app affiliate metadata that more than one route
// needs (the /api/affiliate/complete proxy and the /api/affiliate/agreement-pdf
// renderer). Extracted here so the app-slug -> brand mapping, the per-app
// commission/attribution figures and the agreement version live in exactly
// one place and never drift between the two routes.

import type { BrandKey } from "@/app/affiliate/_shared/brands";

// Bump in lockstep with the on-site /legal/affiliate-agreement page and the
// AGREEMENT_SECTIONS_* copy in affiliateAgreementPdf.ts.
export const AGREEMENT_VERSION = "v1.0-2026-05-21";

// App-slug (= DB slug, what KLAR_ADMIN_APPS uses) to brand-key (= the
// onboarding-shell brand identifier in _shared/brands.ts). Two apps have a
// historical mismatch: the "yarn-stash" DB-slug maps to brand "yarnstash"
// (no dash), and the "moto" DB-slug maps to brand "throttleup" (the public
// product name). All other apps share the same string for both.
export const APP_TO_BRAND: Record<string, BrandKey> = {
  "yarn-stash": "yarnstash",
  moto: "throttleup",
  wavelength: "wavelength",
  kelva: "kelva",
  trubel: "trubel",
  myloo: "myloo",
};

// Reverse of APP_TO_BRAND. The agreement-pdf download route only receives the
// brand key from the client, so it resolves the DB slug (and thus APP_META)
// back through this map.
export const BRAND_TO_APP: Record<BrandKey, string> = {
  yarnstash: "yarn-stash",
  throttleup: "moto",
  wavelength: "wavelength",
  kelva: "kelva",
  trubel: "trubel",
  myloo: "myloo",
};

// Per-app metadata the confirmation email composer + the agreement PDF need.
export const APP_META: Record<string, { appName: string; commissionPct: number; attributionMonths: number }> = {
  "yarn-stash": { appName: "Yarn-Stash", commissionPct: 50, attributionMonths: 24 },
  moto:         { appName: "ThrottleUp", commissionPct: 25, attributionMonths: 12 },
  wavelength:   { appName: "Wavelength", commissionPct: 30, attributionMonths: 12 },
  kelva:        { appName: "Kelva",      commissionPct: 28, attributionMonths: 12 },
  trubel:       { appName: "Trubel",     commissionPct: 50, attributionMonths: 24 },
  myloo:        { appName: "MyLoo",      commissionPct: 26, attributionMonths: 12 },
};
