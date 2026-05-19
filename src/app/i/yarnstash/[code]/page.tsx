// Influencer invite landing: /i/yarnstash/<code>
//
// Hosted on getklar.org as the affiliate link target until the dedicated
// yarn-stash domain is purchased. Thin server shell; logic in InstallClient.

import { use } from "react";
import { Gloock, Newsreader } from "next/font/google";
import { InstallClient } from "./InstallClient";

// Atelier brand faces (scoped to this route, not the klar root layout):
// Gloock = chunky cozy display serif, Newsreader = editorial italic accent.
const display = Gloock({
  weight: "400",
  subsets: ["latin"],
  variable: "--ys-display",
  display: "swap",
});

const editorial = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--ys-editorial",
  display: "swap",
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
    <div className={`${display.variable} ${editorial.variable}`}>
      <InstallClient code={code} />
    </div>
  );
}
