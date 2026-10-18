// Influencer invite landing: /i/throttleup/<code>
//
// Hosted on getklar.org as the affiliate link target until a dedicated
// throttleup domain is purchased. Thin server shell; logic in InstallClient.

import { use } from "react";
import localFont from "next/font/local";
import { InstallClient } from "./InstallClient";

// ThrottleUp brand faces: Boldonse for the display, Inter for body text —
// matches the in-app type stack.
const boldonse = localFont({
  src: "../../../../fonts/boldonse.woff2",
  weight: "400",
  variable: "--tu-display",
  display: "swap",
});

const inter = localFont({
  src: "../../../../fonts/inter.woff2",
  weight: "100 900",
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
    <div className={`${boldonse.variable} ${inter.variable}`}>
      <InstallClient code={code} />
    </div>
  );
}
