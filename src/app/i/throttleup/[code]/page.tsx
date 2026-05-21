// Influencer invite landing: /i/throttleup/<code>
//
// Hosted on getklar.org as the affiliate link target until a dedicated
// throttleup domain is purchased. Thin server shell; logic in InstallClient.

import { use } from "react";
import { Boldonse, Inter } from "next/font/google";
import { InstallClient } from "./InstallClient";

// ThrottleUp brand faces: Boldonse for the display, Inter for body text —
// matches the in-app type stack.
const display = Boldonse({
  weight: "400",
  subsets: ["latin"],
  variable: "--tu-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--tu-body",
  display: "swap",
});

export default function ThrottleUpInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = use(params);
  // Mirror the Moto app's normaliser (services/referral.ts Shape-B):
  // uppercase, restricted charset, max 32 chars. Keeping the regex identical
  // is what lets the clipboard token round-trip into capture_referral.
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
