import type { Metadata } from "next";
import { Space_Grotesk, Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AnalyticsTracker from "./AnalyticsTracker";

/* Display: Space Grotesk — clean, normally-proportioned geometric grotesque.
   Deliberately not an elongated/condensed face (Syne read as too stretched). */
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/* Editorial: Fraunces — high-contrast old-style serif with optical sizing
   and wonk. The strongest "made by a human" signal on the page. */
const editorial = Fraunces({
  variable: "--font-editorial",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

/* Body: Manrope (geometric sans, not banned) */
const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/* Mono labels + tech indicators */
const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Klar · Indie App Studio",
  description:
    "Zero tech background, self-taught, six apps shipped in public. Trubel, MyLoo, Wavelength, Yarn-Stash, Kelva, ThrottleUp.",
  metadataBase: new URL("https://klar-five.vercel.app"),
  openGraph: {
    title: "Klar · Indie App Studio",
    description: "No tech background. Self-taught. Shipped anyway.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${display.variable} ${editorial.variable} ${manrope.variable} ${jetbrains.variable} grain antialiased`}
      >
        {children}
        <AnalyticsTracker />
      </body>
    </html>
  );
}
