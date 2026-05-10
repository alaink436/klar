import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
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
  title: "Klar — Studio for the Generation Scroll",
  description:
    "Klar baut Apps für die Generation Scroll. Trubel, MyLoo, Wavelength, Yarn-Stash.",
  metadataBase: new URL("https://klar.studio"),
  openGraph: {
    title: "Klar",
    description: "Studio for the Generation Scroll.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body
        className={`${spaceGrotesk.variable} ${instrumentSerif.variable} ${inter.variable} ${jetbrains.variable} grain antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
