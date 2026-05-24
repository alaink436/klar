"use client";

import { useSearchParams } from "next/navigation";
import { OnboardingShell } from "../../_shared/onboarding";
import type { BrandKey } from "../../_shared/brands";

export function PreviewClient({ brand }: { brand: BrandKey }) {
  const sp = useSearchParams();
  const stepRaw = sp?.get("step");
  const step = stepRaw ? Math.max(0, Math.min(3, parseInt(stepRaw, 10) || 0)) : 0;
  return <OnboardingShell brand={brand} handle="@testcreator" initialStep={step} />;
}
