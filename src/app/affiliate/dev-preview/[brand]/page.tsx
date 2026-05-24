// Dev-only preview route for the affiliate onboarding. Mounts the shared
// OnboardingShell with mock data so the page can be inspected without a
// valid setup_token. Returns 404 in production so it never ships to users.

import { notFound } from "next/navigation";
import { use } from "react";
import { PreviewClient } from "./PreviewClient";
import "../../_shared/affiliate-onboarding.css";

export const dynamic = "force-dynamic";

export default function DevPreviewPage({ params }: { params: Promise<{ brand: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { brand } = use(params);
  const allowed = ["yarnstash", "throttleup", "wavelength", "kelva", "trubel", "myloo"] as const;
  if (!(allowed as readonly string[]).includes(brand)) notFound();
  return <PreviewClient brand={brand as (typeof allowed)[number]} />;
}
