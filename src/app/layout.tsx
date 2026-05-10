import type { Metadata } from "next";
import {
  Space_Grotesk,
  Instrument_Serif,
  Inter,
  JetBrains_Mono,
  Bowlby_One_SC,
  Bungee,
  Major_Mono_Display,
  Honk,
  Audiowide,
  Workbench,
  Tourney,
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

const bowlby = Bowlby_One_SC({
  variable: "--font-bowlby",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const bungee = Bungee({
  variable: "--font-bungee",
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
const workbench = Workbench({
  variable: "--font-workbench",
  subsets: ["latin"],
  display: "swap",
});
const tourney = Tourney({
  variable: "--font-tourney",
  subsets: ["latin"],
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
        className={`${spaceGrotesk.variable} ${instrumentSerif.variable} ${inter.variable} ${jetbrains.variable} ${bowlby.variable} ${bungee.variable} ${majorMono.variable} ${honk.variable} ${audiowide.variable} ${workbench.variable} ${tourney.variable} grain antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
