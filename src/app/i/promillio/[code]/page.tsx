// Influencer invite landing: /i/promillio/<code>
//
// Hosted on getklar.org as the affiliate link target (Promillo has no own
// domain; the ASC legal pages live under getklar.org/promillo too).
// Thin server shell; logic in InstallClient.

import { use } from "react";
import { Fredoka, Nunito } from "next/font/google";
import { InstallClient } from "./InstallClient";

// Promillo brand faces — the same Google fonts the app loads via
// @expo-google-fonts (constants/promillo.ts): Fredoka = chunky display,
// Nunito = rounded body.
const display = Fredoka({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--pm-display",
  display: "swap",
});

const body = Nunito({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
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
    <div className={`${display.variable} ${body.variable}`}>
      <InstallClient code={code} />
    </div>
  );
}
