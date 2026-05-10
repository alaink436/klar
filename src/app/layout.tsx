import type { Metadata } from "next";
import {
  Space_Grotesk,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Klar — Indie App Studio",
  description:
    "Klar builds apps for the generation scroll. Trubel, MyLoo, Wavelength, Yarn-Stash. One-person studio out of Bern, Switzerland.",
  metadataBase: new URL("https://klar-five.vercel.app"),
  openGraph: {
    title: "Klar — Indie App Studio",
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
        className={`${spaceGrotesk.variable} ${instrumentSerif.variable} ${inter.variable} ${jetbrains.variable} grain antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
