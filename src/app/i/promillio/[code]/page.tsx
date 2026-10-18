// Influencer invite landing: /i/promillio/<code>
//
// Hosted on getklar.org as the affiliate link target (Promillo has no own
// domain; the ASC legal pages live under getklar.org/promillo too).
// Thin server shell; logic in InstallClient.

import { use } from "react";
import localFont from "next/font/local";
import { InstallClient } from "./InstallClient";

// Promillo brand faces — the same Google fonts the app loads via
// @expo-google-fonts (constants/promillo.ts): Fredoka = chunky display,
// Nunito = rounded body.
const fredoka = localFont({
  src: "../../../../fonts/fredoka.woff2",
  weight: "500 700",
  variable: "--pm-display",
  display: "swap",
});

// One face per weight, as Google served it: 600 is not among them, so a 600
// still renders at 700 rather than at the variable font's true 600.
const nunito = localFont({
  src: [
    { path: "../../../../fonts/nunito.woff2", weight: "500" },
    { path: "../../../../fonts/nunito.woff2", weight: "700" },
    { path: "../../../../fonts/nunito.woff2", weight: "800" },
  ],
  variable: "--pm-body",
  display: "swap",
});

export default function PromilloInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = use(params);
  // Mirror the app's normalizeCode (promillio-app services/referral.ts):
  // uppercase, restricted charset, max 32 chars. Keeping this identical is
  // what lets the clipboard token round-trip into validate_referral_code.
  const code = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]/g, "")
    .slice(0, 32);

  return (
    <div className={`${fredoka.variable} ${nunito.variable}`}>
      <InstallClient code={code} />
    </div>
  );
}
