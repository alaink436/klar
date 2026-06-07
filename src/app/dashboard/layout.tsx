// Klar Affiliate-Dashboard shell. The dashboard lives at getklar.org/dashboard
// and is the only place an affiliate logs in to see earnings, funnel, and
// the cancel button. Login/signup/magic-link sub-routes share this shell.
//
// We deliberately use the existing klar globals.css tokens (oklch palette,
// Space Grotesk + Fraunces + Manrope + JetBrains Mono fonts that are
// already loaded by the root layout) so the dashboard inherits the brand
// without a second font payload.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Dashboard · Klar",
  description: "Earnings, Funnel und Vertragsverwaltung für Klar Affiliates.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        // Light scheme scoped to the whole affiliate dashboard. Pages use
        // var(--fg)/--bg + color-mix surfaces, so flipping these five tokens
        // turns the entire dashboard (and the recharts area via currentColor)
        // light without touching the global palette.
        ["--bg" as string]: "oklch(0.99 0.004 270)",
        ["--fg" as string]: "oklch(0.20 0.01 270)",
        ["--fg-2" as string]: "oklch(0.42 0.01 270)",
        ["--fg-3" as string]: "oklch(0.56 0.008 270)",
        ["--fg-4" as string]: "oklch(0.70 0.006 270)",
        minHeight: "100dvh",
        background: "var(--bg)",
        color: "var(--fg)",
        fontFamily: "var(--font-body, var(--font-body, system-ui))",
      } as React.CSSProperties}
    >
      {children}
    </main>
  );
}
