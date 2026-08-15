import { Archivo, Literata, Martian_Mono } from "next/font/google";
import "../os.css";

// The Klar OS pages are the one part of this site that is not the dark klar
// brutalist shell: they are light paper with their own type. Rather than fight
// the root layout, they mount their own root here — the fonts land on this
// wrapper (next/font puts its variables on whatever carries the className) and
// os.css scopes every rule under .os-root, so nothing reaches /admin or /log.
//
// Variables are --font-os-*: this app's root layout already defines
// --font-display / --font-body / --font-mono as Space Grotesk / Manrope /
// JetBrains, and reusing those names would swap the fonts under the whole site.
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-os-display",
});

const body = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-os-body",
});

const mono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-os-mono",
});

export default function OsShell({ children }) {
  return (
    <div className={`os-root ${display.variable} ${body.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
