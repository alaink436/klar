import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AnalyticsTracker from "./AnalyticsTracker";

// All fonts on this site are self-hosted files in src/fonts, built 2026-10-18
// from the google/fonts sources and checked glyph by glyph against what Google
// Fonts serves (latin subset, same pinned axes). next/font/google fetched them
// at build time and failed the production builds of 17.10. and 18.10.
//
// ⚠️ Turbopack names a local font after its const: two `const display =
// localFont(...)` in different files become one CSS family "display" and
// overwrite each other on any page that loads both. Name each const after
// its font, unique across the whole site.

/* Display: Space Grotesk — clean, normally-proportioned geometric grotesque.
   Deliberately not an elongated/condensed face (Syne read as too stretched). */
const spaceGrotesk = localFont({
  src: "../fonts/spacegrotesk.woff2",
  weight: "400 700",
  variable: "--font-display",
  display: "swap",
});

/* Editorial: Fraunces — high-contrast old-style serif with optical sizing
   and wonk. The strongest "made by a human" signal on the page. */
const fraunces = localFont({
  src: [
    { path: "../fonts/fraunces.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/fraunces-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-editorial",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

/* Body: Manrope (geometric sans, not banned) */
const manrope = localFont({
  src: "../fonts/manrope.woff2",
  weight: "300 700",
  variable: "--font-body",
  display: "swap",
});

/* Mono labels + tech indicators */
const jetbrains = localFont({
  src: "../fonts/jetbrainsmono.woff2",
  weight: "400 600",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Klar Studios",
  description:
    "Apps by Klar Studios, made in Switzerland. Pocketmate, Anime Vault, My Yarn Stash, Kelva, Basalt and Learnbound.",
  metadataBase: new URL("https://getklar.org"),
  openGraph: {
    title: "Klar Studios",
    description: "Apps by Klar Studios, made in Switzerland.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${fraunces.variable} ${manrope.variable} ${jetbrains.variable} grain antialiased`}
      >
        {children}
        <AnalyticsTracker />
      </body>
    </html>
  );
}
