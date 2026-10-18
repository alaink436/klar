// Influencer invite landing: /i/yarnstash/<code>
//
// Hosted on getklar.org as the affiliate link target until the dedicated
// yarn-stash domain is purchased. Thin server shell; logic in InstallClient.

import { use } from "react";
import localFont from "next/font/local";
import { InstallClient } from "./InstallClient";

// Atelier brand faces (scoped to this route, not the klar root layout):
// Gloock = chunky cozy display serif, Newsreader = editorial italic accent.
const gloock = localFont({
  src: "../../../../fonts/gloock.woff2",
  weight: "400",
  variable: "--ys-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const newsreader = localFont({
  src: [
    { path: "../../../../fonts/newsreader.woff2", weight: "200 800", style: "normal" },
    { path: "../../../../fonts/newsreader-italic.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--ys-editorial",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export default function YarnStashInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = use(params);
  // Mirror the app's normalizeCode (Yarn-Stash services/referral.ts):
  // uppercase, restricted charset, max 32 chars. Keeping this identical is
  // what lets the clipboard token round-trip into validate_referral_code.
  const code = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]/g, "")
    .slice(0, 32);

  return (
    <div className={`${gloock.variable} ${newsreader.variable}`}>
      <InstallClient code={code} />
    </div>
  );
}
