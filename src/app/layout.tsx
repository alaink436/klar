import type { Metadata } from "next";
import { Anton, Eczar, Manrope, JetBrains_Mono } from "next/font/google";
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
        className={`${anton.variable} ${eczar.variable} ${manrope.variable} ${jetbrains.variable} grain antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
