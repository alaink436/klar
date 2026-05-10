import type { Metadata } from "next";
import {
  Anton,
  Eczar,
  Manrope,
  JetBrains_Mono,
  Bowlby_One_SC,
  Honk,
  Audiowide,
  Major_Mono_Display,
} from "next/font/google";
import "./globals.css";

/* Display: Anton (condensed, brutalist, distinct — not in reflex list) */
const anton = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

/* Editorial italic: Eczar (display serif with strong italic) */
const eczar = Eczar({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal"],
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

/* Glitch overlay fonts (4 instead of 6 — perf) */
const bowlby = Bowlby_One_SC({
  variable: "--font-bowlby",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const honk = Honk({
  variable: "--font-honk",
  subsets: ["latin"],
  display: "swap",
});
const audiowide = Audiowide({
  variable: "--font-audiowide",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const majorMono = Major_Mono_Display({
  variable: "--font-major-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Klar · Indie App Studio",
  description:
    "Klar builds apps for the generation scroll. Trubel, MyLoo, Wavelength, Yarn-Stash. Solo studio with AI in every loop.",
  metadataBase: new URL("https://klar-five.vercel.app"),
  openGraph: {
    title: "Klar · Indie App Studio",
    description: "Apps for the generation scroll.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${anton.variable} ${eczar.variable} ${manrope.variable} ${jetbrains.variable} ${bowlby.variable} ${honk.variable} ${audiowide.variable} ${majorMono.variable} grain antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
