import localFont from "next/font/local";
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
// font-stretch range as Google declared it: os.css sets the wordmark to 112%.
const archivo = localFont({
  src: "../../fonts/archivo.woff2",
  weight: "100 900",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  variable: "--font-os-display",
});

const literata = localFont({
  src: [
    { path: "../../fonts/literata.woff2", weight: "200 900", style: "normal" },
    { path: "../../fonts/literata-italic.woff2", weight: "200 900", style: "italic" },
  ],
  variable: "--font-os-body",
  adjustFontFallback: "Times New Roman",
});

// One face per weight, as Google served it (no 600).
const martianMono = localFont({
  src: [
    { path: "../../fonts/martianmono.woff2", weight: "400" },
    { path: "../../fonts/martianmono.woff2", weight: "500" },
    { path: "../../fonts/martianmono.woff2", weight: "700" },
  ],
  variable: "--font-os-mono",
});

export default function OsShell({ children }) {
  return (
    <div className={`os-root ${archivo.variable} ${literata.variable} ${martianMono.variable}`}>
      {children}
    </div>
  );
}
